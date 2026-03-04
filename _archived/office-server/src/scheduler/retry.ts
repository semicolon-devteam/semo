/**
 * Retry Manager
 *
 * Manages job retry logic with exponential backoff.
 */

import { EventEmitter } from 'events';
import type { Job, AgentRole } from '../types.js';

export interface RetryConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay cap */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
  /** Role-specific retry limits */
  roleRetryLimits: Partial<Record<AgentRole, number>>;
  /** Non-retryable error patterns */
  nonRetryablePatterns: RegExp[];
}

export interface RetryEntry {
  jobId: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: number;
  timer?: NodeJS.Timeout;
  status: 'pending' | 'scheduled' | 'exhausted';
}

export interface RetryDecision {
  shouldRetry: boolean;
  delay?: number;
  reason: string;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 5000, // 5 seconds
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  roleRetryLimits: {
    PO: 2,
    Architect: 2,
    FE: 3,
    BE: 3,
    QA: 4, // More retries for flaky tests
    DevOps: 2,
  },
  nonRetryablePatterns: [
    /permission denied/i,
    /authentication failed/i,
    /invalid credentials/i,
    /not found/i,
    /syntax error/i,
    /type error/i,
  ],
};

export class RetryManager extends EventEmitter {
  private config: RetryConfig;
  private retries: Map<string, RetryEntry> = new Map();

  constructor(config: Partial<RetryConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      roleRetryLimits: {
        ...DEFAULT_CONFIG.roleRetryLimits,
        ...config.roleRetryLimits,
      },
      nonRetryablePatterns: [
        ...DEFAULT_CONFIG.nonRetryablePatterns,
        ...(config.nonRetryablePatterns || []),
      ],
    };
  }

  /**
   * Record a job failure and decide whether to retry
   */
  recordFailure(job: Job, error: string, role?: AgentRole): RetryDecision {
    let entry = this.retries.get(job.id);

    if (!entry) {
      entry = {
        jobId: job.id,
        attempts: 0,
        status: 'pending',
      };
      this.retries.set(job.id, entry);
    }

    entry.attempts++;
    entry.lastError = error;

    // Check if error is non-retryable
    if (this.isNonRetryable(error)) {
      entry.status = 'exhausted';
      this.emit('exhausted', {
        jobId: job.id,
        reason: 'Non-retryable error',
        error,
      });
      return {
        shouldRetry: false,
        reason: `Non-retryable error: ${error}`,
      };
    }

    // Check retry limit
    const maxRetries = this.getMaxRetriesForRole(role);
    if (entry.attempts >= maxRetries) {
      entry.status = 'exhausted';
      this.emit('exhausted', {
        jobId: job.id,
        reason: 'Max retries exceeded',
        attempts: entry.attempts,
      });
      return {
        shouldRetry: false,
        reason: `Max retries (${maxRetries}) exceeded`,
      };
    }

    // Calculate delay with exponential backoff
    const delay = this.calculateDelay(entry.attempts);
    entry.nextRetryAt = Date.now() + delay;
    entry.status = 'scheduled';

    this.emit('scheduled', {
      jobId: job.id,
      attempt: entry.attempts,
      delay,
      nextRetryAt: entry.nextRetryAt,
    });

    return {
      shouldRetry: true,
      delay,
      reason: `Retry ${entry.attempts}/${maxRetries} scheduled in ${delay}ms`,
    };
  }

  /**
   * Schedule a retry with callback
   */
  scheduleRetry(
    job: Job,
    delay: number,
    callback: () => void
  ): void {
    const entry = this.retries.get(job.id);
    if (!entry) return;

    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    entry.timer = setTimeout(() => {
      entry.status = 'pending';
      this.emit('retrying', { jobId: job.id, attempt: entry.attempts + 1 });
      callback();
    }, delay);
  }

  /**
   * Cancel pending retry
   */
  cancel(jobId: string): void {
    const entry = this.retries.get(jobId);
    if (!entry) return;

    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    this.retries.delete(jobId);
    this.emit('cancelled', { jobId });
  }

  /**
   * Mark job as succeeded (clear retry state)
   */
  recordSuccess(jobId: string): void {
    this.cancel(jobId);
    this.emit('succeeded', { jobId });
  }

  /**
   * Get retry state for a job
   */
  getRetryState(jobId: string): RetryEntry | undefined {
    return this.retries.get(jobId);
  }

  /**
   * Get all pending retries
   */
  getPendingRetries(): RetryEntry[] {
    return Array.from(this.retries.values()).filter(
      (e) => e.status === 'scheduled'
    );
  }

  /**
   * Get statistics
   */
  getStats(): RetryStats {
    const entries = Array.from(this.retries.values());
    return {
      pending: entries.filter((e) => e.status === 'pending').length,
      scheduled: entries.filter((e) => e.status === 'scheduled').length,
      exhausted: entries.filter((e) => e.status === 'exhausted').length,
      totalAttempts: entries.reduce((sum, e) => sum + e.attempts, 0),
    };
  }

  /**
   * Shutdown and cancel all pending retries
   */
  shutdown(): void {
    for (const [jobId] of this.retries) {
      this.cancel(jobId);
    }
  }

  private getMaxRetriesForRole(role?: AgentRole): number {
    if (role && this.config.roleRetryLimits[role] !== undefined) {
      return this.config.roleRetryLimits[role]!;
    }
    return this.config.maxRetries;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (multiplier ^ attempt)
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Apply cap
    delay = Math.min(delay, this.config.maxDelay);

    // Apply jitter
    const jitter = delay * this.config.jitterFactor * (Math.random() * 2 - 1);
    delay = Math.round(delay + jitter);

    return Math.max(delay, this.config.baseDelay);
  }

  private isNonRetryable(error: string): boolean {
    return this.config.nonRetryablePatterns.some((pattern) =>
      pattern.test(error)
    );
  }
}

interface RetryStats {
  pending: number;
  scheduled: number;
  exhausted: number;
  totalAttempts: number;
}
