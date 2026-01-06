/**
 * Timeout Manager
 *
 * Manages job execution timeouts with automatic cleanup.
 */

import { EventEmitter } from 'events';
import type { Job, AgentRole } from '../types.js';

export interface TimeoutConfig {
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Role-specific timeout overrides */
  roleTimeouts: Partial<Record<AgentRole, number>>;
  /** Grace period before force termination */
  gracePeriod: number;
}

export interface TimeoutEntry {
  jobId: string;
  startTime: number;
  timeout: number;
  timer: NodeJS.Timeout;
  graceTimer?: NodeJS.Timeout;
  status: 'active' | 'grace' | 'expired';
}

const DEFAULT_CONFIG: TimeoutConfig = {
  defaultTimeout: 5 * 60 * 1000, // 5 minutes
  roleTimeouts: {
    PO: 10 * 60 * 1000, // 10 min for planning
    Architect: 10 * 60 * 1000,
    FE: 15 * 60 * 1000, // 15 min for coding
    BE: 15 * 60 * 1000,
    QA: 20 * 60 * 1000, // 20 min for testing
    DevOps: 10 * 60 * 1000,
  },
  gracePeriod: 30 * 1000, // 30 seconds
};

export class TimeoutManager extends EventEmitter {
  private config: TimeoutConfig;
  private timeouts: Map<string, TimeoutEntry> = new Map();

  constructor(config: Partial<TimeoutConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      roleTimeouts: {
        ...DEFAULT_CONFIG.roleTimeouts,
        ...config.roleTimeouts,
      },
    };
  }

  /**
   * Start tracking timeout for a job
   */
  start(job: Job, role?: AgentRole): void {
    if (this.timeouts.has(job.id)) {
      this.clear(job.id);
    }

    const timeout = this.getTimeoutForRole(role);
    const startTime = Date.now();

    const timer = setTimeout(() => {
      this.handleTimeout(job.id);
    }, timeout);

    const entry: TimeoutEntry = {
      jobId: job.id,
      startTime,
      timeout,
      timer,
      status: 'active',
    };

    this.timeouts.set(job.id, entry);
    this.emit('started', { jobId: job.id, timeout });
  }

  /**
   * Clear timeout for a job (on completion)
   */
  clear(jobId: string): void {
    const entry = this.timeouts.get(jobId);
    if (!entry) return;

    clearTimeout(entry.timer);
    if (entry.graceTimer) {
      clearTimeout(entry.graceTimer);
    }

    this.timeouts.delete(jobId);
    this.emit('cleared', { jobId });
  }

  /**
   * Extend timeout for a job (on progress)
   */
  extend(jobId: string, additionalTime?: number): void {
    const entry = this.timeouts.get(jobId);
    if (!entry || entry.status !== 'active') return;

    clearTimeout(entry.timer);

    const extension = additionalTime || entry.timeout / 2;
    const newTimeout = entry.timeout + extension;

    entry.timer = setTimeout(() => {
      this.handleTimeout(jobId);
    }, newTimeout - (Date.now() - entry.startTime));

    entry.timeout = newTimeout;
    this.emit('extended', { jobId, newTimeout });
  }

  /**
   * Get remaining time for a job
   */
  getRemaining(jobId: string): number | null {
    const entry = this.timeouts.get(jobId);
    if (!entry) return null;

    const elapsed = Date.now() - entry.startTime;
    return Math.max(0, entry.timeout - elapsed);
  }

  /**
   * Check if a job has timed out
   */
  isTimedOut(jobId: string): boolean {
    const entry = this.timeouts.get(jobId);
    return entry?.status === 'expired' || false;
  }

  /**
   * Get all active timeouts
   */
  getActiveTimeouts(): TimeoutEntry[] {
    return Array.from(this.timeouts.values()).filter(
      (e) => e.status === 'active'
    );
  }

  /**
   * Get statistics
   */
  getStats(): TimeoutStats {
    const entries = Array.from(this.timeouts.values());
    return {
      active: entries.filter((e) => e.status === 'active').length,
      grace: entries.filter((e) => e.status === 'grace').length,
      expired: entries.filter((e) => e.status === 'expired').length,
    };
  }

  /**
   * Shutdown and clear all timeouts
   */
  shutdown(): void {
    for (const [jobId] of this.timeouts) {
      this.clear(jobId);
    }
  }

  private getTimeoutForRole(role?: AgentRole): number {
    if (role && this.config.roleTimeouts[role]) {
      return this.config.roleTimeouts[role]!;
    }
    return this.config.defaultTimeout;
  }

  private handleTimeout(jobId: string): void {
    const entry = this.timeouts.get(jobId);
    if (!entry) return;

    if (entry.status === 'active') {
      // Enter grace period
      entry.status = 'grace';
      this.emit('warning', { jobId, message: 'Job entering grace period' });

      entry.graceTimer = setTimeout(() => {
        this.handleGraceExpired(jobId);
      }, this.config.gracePeriod);
    }
  }

  private handleGraceExpired(jobId: string): void {
    const entry = this.timeouts.get(jobId);
    if (!entry) return;

    entry.status = 'expired';
    this.emit('timeout', {
      jobId,
      duration: Date.now() - entry.startTime,
    });
  }
}

interface TimeoutStats {
  active: number;
  grace: number;
  expired: number;
}
