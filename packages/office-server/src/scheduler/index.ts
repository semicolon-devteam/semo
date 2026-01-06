/**
 * Job Scheduler
 *
 * Manages job queue with dependency-based scheduling,
 * timeout management, retry logic, and role-based parallel limits.
 */

import { EventEmitter } from 'events';
import type { Job, JobStatus, DecomposedJob, AgentRole } from '../types.js';
import { TimeoutManager } from './timeout.js';
import { RetryManager } from './retry.js';
import { DependencyResolver } from './dependency.js';

export interface SchedulerConfig {
  /** Maximum total parallel jobs */
  maxParallelJobs: number;
  /** Role-specific parallel limits */
  maxConcurrentByRole: Partial<Record<AgentRole, number>>;
  /** Polling interval in milliseconds */
  pollingInterval: number;
  /** Enable timeout management */
  enableTimeout: boolean;
  /** Enable retry on failure */
  enableRetry: boolean;
}

export interface JobExecution {
  job: Job;
  role?: AgentRole;
  startedAt: Date;
  commandId?: string;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxParallelJobs: 6,
  maxConcurrentByRole: {
    PO: 1,
    PM: 1,
    Architect: 1,
    FE: 2,
    BE: 2,
    QA: 2,
    DevOps: 1,
  },
  pollingInterval: 5000, // 5 seconds
  enableTimeout: true,
  enableRetry: true,
};

export class JobScheduler extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private executions: Map<string, JobExecution> = new Map();
  private config: SchedulerConfig;
  private running: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;

  // Managers
  readonly timeoutManager: TimeoutManager;
  readonly retryManager: RetryManager;
  readonly dependencyResolver: DependencyResolver;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      maxConcurrentByRole: {
        ...DEFAULT_CONFIG.maxConcurrentByRole,
        ...config.maxConcurrentByRole,
      },
    };

    this.timeoutManager = new TimeoutManager();
    this.retryManager = new RetryManager();
    this.dependencyResolver = new DependencyResolver();

    this.setupEventHandlers();
  }

  /**
   * Enqueue decomposed jobs
   */
  async enqueue(decomposedJobs: DecomposedJob[], officeId: string): Promise<Job[]> {
    const jobs: Job[] = [];

    for (const decomposed of decomposedJobs) {
      const job: Job = {
        id: decomposed.id,
        office_id: officeId,
        description: decomposed.description,
        status: decomposed.depends_on.length === 0 ? 'ready' : 'pending',
        depends_on: decomposed.depends_on,
        priority: decomposed.priority,
        created_at: new Date().toISOString(),
      };

      this.jobs.set(job.id, job);
      this.dependencyResolver.addJob(job);
      jobs.push(job);

      this.emit('jobEnqueued', { job, officeId });
    }

    return jobs;
  }

  /**
   * Get jobs ready for execution
   */
  getReadyJobs(): Job[] {
    const readyIds = this.dependencyResolver.getReadyJobs();
    const ready: Job[] = [];

    for (const jobId of readyIds) {
      const job = this.jobs.get(jobId);
      if (job && job.status === 'ready') {
        ready.push(job);
      }
    }

    // Sort by priority (lower is higher priority)
    return ready.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Start a job
   */
  startJob(jobId: string, role?: AgentRole, commandId?: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'ready') return undefined;

    // Check role concurrency limit
    if (role && !this.canStartJobForRole(role)) {
      this.emit('roleLimitReached', { jobId, role });
      return undefined;
    }

    // Check total concurrency limit
    if (this.executions.size >= this.config.maxParallelJobs) {
      this.emit('parallelLimitReached', { jobId });
      return undefined;
    }

    job.status = 'processing';
    job.started_at = new Date().toISOString();

    const execution: JobExecution = {
      job,
      role,
      startedAt: new Date(),
      commandId,
    };
    this.executions.set(jobId, execution);

    // Start timeout tracking
    if (this.config.enableTimeout) {
      this.timeoutManager.start(job, role);
    }

    this.emit('jobStarted', { job, role, commandId });
    return job;
  }

  /**
   * Complete a job successfully
   */
  completeJob(jobId: string, prNumber?: number): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.status = 'done';
    job.completed_at = new Date().toISOString();
    if (prNumber) {
      job.pr_number = prNumber;
    }

    // Cleanup
    this.executions.delete(jobId);
    this.timeoutManager.clear(jobId);
    this.retryManager.recordSuccess(jobId);

    // Update dependencies and get newly ready jobs
    const readyJobs = this.dependencyResolver.markCompleted(jobId);

    // Update status of newly ready jobs
    for (const readyJobId of readyJobs) {
      const readyJob = this.jobs.get(readyJobId);
      if (readyJob && readyJob.status === 'pending') {
        readyJob.status = 'ready';
      }
    }

    this.emit('jobCompleted', { job, prNumber, newlyReadyJobs: readyJobs });
    return job;
  }

  /**
   * Fail a job
   */
  failJob(jobId: string, error?: string, role?: AgentRole): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    // Cleanup execution
    this.executions.delete(jobId);
    this.timeoutManager.clear(jobId);

    // Check if should retry
    if (this.config.enableRetry && error) {
      const decision = this.retryManager.recordFailure(job, error, role);

      if (decision.shouldRetry && decision.delay) {
        job.status = 'pending'; // Reset to pending for retry
        this.emit('jobRetryScheduled', {
          job,
          error,
          delay: decision.delay,
          reason: decision.reason,
        });

        this.retryManager.scheduleRetry(job, decision.delay, () => {
          job.status = 'ready';
          this.emit('jobReadyForRetry', { job });
        });

        return job;
      }
    }

    // Mark as failed
    job.status = 'failed';
    job.completed_at = new Date().toISOString();

    // Cascade failure to dependents
    const blockedJobs = this.dependencyResolver.markFailed(jobId);

    this.emit('jobFailed', { job, error, blockedJobs });
    return job;
  }

  /**
   * Mark a job's PR as merged
   */
  markMerged(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'done') return undefined;

    job.status = 'merged';
    this.emit('jobMerged', { job });
    return job;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    this.executions.delete(jobId);
    this.timeoutManager.clear(jobId);
    this.retryManager.cancel(jobId);
    this.dependencyResolver.removeJob(jobId);

    job.status = 'failed';
    job.completed_at = new Date().toISOString();

    this.emit('jobCancelled', { job });
    return job;
  }

  /**
   * Cancel all jobs for an office
   */
  cancelAllJobs(officeId: string): number {
    let count = 0;
    for (const [jobId, job] of this.jobs) {
      if (job.office_id === officeId && job.status !== 'done' && job.status !== 'merged') {
        this.cancelJob(jobId);
        count++;
      }
    }
    return count;
  }

  /**
   * Get all jobs for an office
   */
  getJobs(officeId: string): Job[] {
    return Array.from(this.jobs.values()).filter((j) => j.office_id === officeId);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): JobExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get execution statistics
   */
  getStats(officeId: string): SchedulerStats {
    const officeJobs = this.getJobs(officeId);

    const byStatus: Record<JobStatus, number> = {
      pending: 0,
      ready: 0,
      processing: 0,
      done: 0,
      merged: 0,
      failed: 0,
    };

    const byRole: Partial<Record<AgentRole, number>> = {};

    for (const job of officeJobs) {
      byStatus[job.status]++;
    }

    // Count active jobs by role
    for (const execution of this.executions.values()) {
      if (execution.role) {
        byRole[execution.role] = (byRole[execution.role] || 0) + 1;
      }
    }

    return {
      total: officeJobs.length,
      byStatus,
      byRole,
      activeExecutions: this.executions.size,
      completionRate: officeJobs.length > 0
        ? ((byStatus.done + byStatus.merged) / officeJobs.length) * 100
        : 0,
      timeout: this.timeoutManager.getStats(),
      retry: this.retryManager.getStats(),
      dependency: this.dependencyResolver.getStats(),
    };
  }

  /**
   * Start the scheduler polling loop
   */
  start(onJobReady: (job: Job) => Promise<void>): void {
    if (this.running) return;
    this.running = true;

    const poll = async () => {
      if (!this.running) return;

      try {
        const readyJobs = this.getReadyJobs();
        const processing = this.executions.size;

        // Calculate available slots
        const availableSlots = this.config.maxParallelJobs - processing;
        const toStart = readyJobs.slice(0, availableSlots);

        for (const job of toStart) {
          const started = this.startJob(job.id);
          if (started) {
            onJobReady(job).catch((error) => {
              console.error(`Job ${job.id} failed:`, error);
              this.failJob(job.id, error?.message);
            });
          }
        }
      } catch (error) {
        console.error('Scheduler poll error:', error);
      }

      // Schedule next poll
      this.pollTimer = setTimeout(poll, this.config.pollingInterval);
    };

    poll();
    this.emit('started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.emit('stopped');
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.stop();
    this.timeoutManager.shutdown();
    this.retryManager.shutdown();
    this.dependencyResolver.clear();
    this.jobs.clear();
    this.executions.clear();
    this.emit('shutdown');
  }

  /**
   * Check if a job can start based on role concurrency
   */
  private canStartJobForRole(role: AgentRole): boolean {
    const limit = this.config.maxConcurrentByRole[role];
    if (limit === undefined) return true;

    let count = 0;
    for (const execution of this.executions.values()) {
      if (execution.role === role) {
        count++;
      }
    }

    return count < limit;
  }

  /**
   * Get current concurrency for a role
   */
  getRoleConcurrency(role: AgentRole): { current: number; limit: number } {
    const limit = this.config.maxConcurrentByRole[role] ?? this.config.maxParallelJobs;
    let current = 0;

    for (const execution of this.executions.values()) {
      if (execution.role === role) {
        current++;
      }
    }

    return { current, limit };
  }

  private setupEventHandlers(): void {
    // Handle timeout events
    this.timeoutManager.on('timeout', ({ jobId, duration }) => {
      console.warn(`Job ${jobId} timed out after ${duration}ms`);
      this.failJob(jobId, `Execution timed out after ${Math.round(duration / 1000)}s`);
    });

    this.timeoutManager.on('warning', ({ jobId, message }) => {
      this.emit('jobWarning', { jobId, message });
    });

    // Handle retry events
    this.retryManager.on('exhausted', ({ jobId, reason }) => {
      console.warn(`Job ${jobId} retry exhausted: ${reason}`);
    });

    // Handle dependency events
    this.dependencyResolver.on('jobsReady', ({ jobIds }) => {
      for (const jobId of jobIds) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'pending') {
          job.status = 'ready';
        }
      }
      this.emit('dependenciesResolved', { jobIds });
    });

    this.dependencyResolver.on('circularDependency', ({ jobs }) => {
      console.error('Circular dependency detected:', jobs);
      this.emit('circularDependency', { jobs });
    });
  }
}

export interface SchedulerStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  byRole: Partial<Record<AgentRole, number>>;
  activeExecutions: number;
  completionRate: number;
  timeout: { active: number; grace: number; expired: number };
  retry: { pending: number; scheduled: number; exhausted: number; totalAttempts: number };
  dependency: { totalJobs: number; completedJobs: number; totalDependencies: number; maxDepth: number; readyJobs: number };
}

// Re-export sub-modules
export { TimeoutManager } from './timeout.js';
export { RetryManager } from './retry.js';
export { DependencyResolver } from './dependency.js';
