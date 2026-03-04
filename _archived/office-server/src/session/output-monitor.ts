/**
 * Output Monitor
 *
 * Monitors Claude Code session output for completion patterns,
 * error detection, and progress tracking.
 */

import { EventEmitter } from 'events';

export interface MonitorConfig {
  /** Polling interval for output check */
  pollInterval: number;
  /** Idle timeout (no new output) */
  idleTimeout: number;
  /** Maximum output buffer size */
  maxBufferSize: number;
}

export interface OutputEntry {
  timestamp: number;
  content: string;
  type: 'stdout' | 'stderr';
}

export interface CompletionResult {
  completed: boolean;
  success: boolean;
  reason: CompletionReason;
  prNumber?: number;
  commitHash?: string;
  error?: string;
  summary?: string;
}

export type CompletionReason =
  | 'pr_created'
  | 'commit_pushed'
  | 'task_completed'
  | 'error_detected'
  | 'idle_timeout'
  | 'manual_stop'
  | 'pattern_match';

// Completion patterns for different scenarios
const COMPLETION_PATTERNS = {
  // PR creation patterns
  prCreated: [
    /(?:PR|Pull Request)\s*#?(\d+)\s*(?:created|opened)/i,
    /https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/,
    /gh pr create.*(?:pull|PR)\/(\d+)/i,
  ],

  // Commit patterns
  commitPushed: [
    /\[(?:main|master|feature\/[^\]]+)\s+([a-f0-9]{7,40})\]/,
    /git push.*Successfully/i,
    /commit\s+([a-f0-9]{7,40})\s+pushed/i,
  ],

  // Task completion patterns
  taskCompleted: [
    /\[SEMO\].*(?:완료|Completed|Done)/i,
    /Task.*(?:successfully|완료)/i,
    /작업이?\s*완료/,
    /Implementation complete/i,
  ],

  // Error patterns
  errorDetected: [
    /Error:\s*(.+)/i,
    /Failed:\s*(.+)/i,
    /fatal:\s*(.+)/i,
    /exception:\s*(.+)/i,
    /build failed/i,
    /test failed/i,
    /npm ERR!/,
  ],

  // Progress patterns (not completion, but useful for tracking)
  progress: [
    /Step\s+(\d+)\s*(?:of|\/)\s*(\d+)/i,
    /\[(\d+)%\]/,
    /Processing.*(\d+)\s*(?:of|\/)\s*(\d+)/i,
  ],
};

const DEFAULT_CONFIG: MonitorConfig = {
  pollInterval: 2000, // 2 seconds
  idleTimeout: 60000, // 1 minute
  maxBufferSize: 100000, // ~100KB
};

export class OutputMonitor extends EventEmitter {
  private config: MonitorConfig;
  private buffer: OutputEntry[] = [];
  private lastActivityTime: number = Date.now();
  private monitoring: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private totalBufferSize: number = 0;

  constructor(sessionId: string, config: Partial<MonitorConfig> = {}) {
    super();
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring output
   */
  start(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.lastActivityTime = Date.now();

    this.resetIdleTimer();
    this.emit('started', { sessionId: this.sessionId });
  }

  /**
   * Stop monitoring
   */
  stop(reason: CompletionReason = 'manual_stop'): void {
    if (!this.monitoring) return;
    this.monitoring = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.emit('stopped', { sessionId: this.sessionId, reason });
  }

  /**
   * Add output to monitor
   */
  addOutput(content: string, type: 'stdout' | 'stderr' = 'stdout'): CompletionResult | null {
    if (!this.monitoring) return null;

    this.lastActivityTime = Date.now();
    this.resetIdleTimer();

    // Add to buffer
    const entry: OutputEntry = {
      timestamp: Date.now(),
      content,
      type,
    };
    this.buffer.push(entry);
    this.totalBufferSize += content.length;

    // Trim buffer if too large
    this.trimBuffer();

    // Check for completion patterns
    const result = this.checkCompletion(content);
    if (result.completed) {
      this.stop(result.reason);
      this.emit('completion', result);
      return result;
    }

    // Check for progress
    this.checkProgress(content);

    return null;
  }

  /**
   * Check output for completion patterns
   */
  private checkCompletion(content: string): CompletionResult {
    // Check PR creation
    for (const pattern of COMPLETION_PATTERNS.prCreated) {
      const match = content.match(pattern);
      if (match) {
        return {
          completed: true,
          success: true,
          reason: 'pr_created',
          prNumber: parseInt(match[1], 10),
          summary: `PR #${match[1]} created`,
        };
      }
    }

    // Check commit pushed
    for (const pattern of COMPLETION_PATTERNS.commitPushed) {
      const match = content.match(pattern);
      if (match) {
        return {
          completed: true,
          success: true,
          reason: 'commit_pushed',
          commitHash: match[1],
          summary: `Commit ${match[1]} pushed`,
        };
      }
    }

    // Check task completed
    for (const pattern of COMPLETION_PATTERNS.taskCompleted) {
      const match = content.match(pattern);
      if (match) {
        return {
          completed: true,
          success: true,
          reason: 'task_completed',
          summary: 'Task completed successfully',
        };
      }
    }

    // Check errors
    for (const pattern of COMPLETION_PATTERNS.errorDetected) {
      const match = content.match(pattern);
      if (match) {
        return {
          completed: true,
          success: false,
          reason: 'error_detected',
          error: match[1] || match[0],
          summary: `Error detected: ${match[1] || match[0]}`,
        };
      }
    }

    return {
      completed: false,
      success: false,
      reason: 'pattern_match',
    };
  }

  /**
   * Check for progress indicators
   */
  private checkProgress(content: string): void {
    for (const pattern of COMPLETION_PATTERNS.progress) {
      const match = content.match(pattern);
      if (match) {
        let progress: number;
        if (match[2]) {
          // Step X of Y format
          progress = (parseInt(match[1], 10) / parseInt(match[2], 10)) * 100;
        } else {
          // Percentage format
          progress = parseInt(match[1], 10);
        }

        this.emit('progress', {
          sessionId: this.sessionId,
          progress: Math.round(progress),
          raw: match[0],
        });
        break;
      }
    }
  }

  /**
   * Reset idle timer
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      if (this.monitoring) {
        const result: CompletionResult = {
          completed: true,
          success: false,
          reason: 'idle_timeout',
          error: `No output for ${this.config.idleTimeout}ms`,
        };
        this.stop('idle_timeout');
        this.emit('completion', result);
      }
    }, this.config.idleTimeout);
  }

  /**
   * Trim buffer if too large
   */
  private trimBuffer(): void {
    while (this.totalBufferSize > this.config.maxBufferSize && this.buffer.length > 0) {
      const removed = this.buffer.shift();
      if (removed) {
        this.totalBufferSize -= removed.content.length;
      }
    }
  }

  /**
   * Get recent output
   */
  getRecentOutput(limit: number = 50): OutputEntry[] {
    return this.buffer.slice(-limit);
  }

  /**
   * Get full output as string
   */
  getFullOutput(): string {
    return this.buffer.map((e) => e.content).join('\n');
  }

  /**
   * Search output for pattern
   */
  searchOutput(pattern: RegExp): string[] {
    const matches: string[] = [];
    for (const entry of this.buffer) {
      const match = entry.content.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }
    return matches;
  }

  /**
   * Get monitor statistics
   */
  getStats(): MonitorStats {
    return {
      sessionId: this.sessionId,
      monitoring: this.monitoring,
      bufferEntries: this.buffer.length,
      bufferSize: this.totalBufferSize,
      lastActivityAt: new Date(this.lastActivityTime).toISOString(),
      idleDuration: Date.now() - this.lastActivityTime,
    };
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.totalBufferSize = 0;
  }

  /**
   * Check if currently monitoring
   */
  isMonitoring(): boolean {
    return this.monitoring;
  }

  /**
   * Add custom completion pattern
   */
  static addCompletionPattern(
    category: keyof typeof COMPLETION_PATTERNS,
    pattern: RegExp
  ): void {
    COMPLETION_PATTERNS[category].push(pattern);
  }
}

interface MonitorStats {
  sessionId: string;
  monitoring: boolean;
  bufferEntries: number;
  bufferSize: number;
  lastActivityAt: string;
  idleDuration: number;
}
