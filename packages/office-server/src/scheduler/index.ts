/**
 * Job Scheduler
 *
 * Manages job queue with dependency-based scheduling.
 * Jobs are processed in topological order, with parallel execution where possible.
 */

import type { Job, JobStatus, DecomposedJob } from '../types.js';

export interface SchedulerConfig {
  maxParallelJobs: number;
  pollingInterval: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxParallelJobs: 4,
  pollingInterval: 5000, // 5 seconds
};

export class JobScheduler {
  private jobs: Map<string, Job> = new Map();
  private config: SchedulerConfig;
  private running: boolean = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Get jobs ready for execution
   */
  getReadyJobs(): Job[] {
    const ready: Job[] = [];

    for (const job of this.jobs.values()) {
      if (job.status === 'ready') {
        ready.push(job);
      }
    }

    // Sort by priority (lower is higher priority)
    return ready.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Mark a job as started
   */
  startJob(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'ready') return undefined;

    job.status = 'processing';
    job.started_at = new Date().toISOString();
    return job;
  }

  /**
   * Mark a job as completed
   */
  completeJob(jobId: string, prNumber?: number): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.status = 'done';
    job.completed_at = new Date().toISOString();
    if (prNumber) {
      job.pr_number = prNumber;
    }

    // Update dependent jobs
    this.updateDependentJobs(jobId);

    return job;
  }

  /**
   * Mark a job as failed
   */
  failJob(jobId: string, error?: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.status = 'failed';
    job.completed_at = new Date().toISOString();

    return job;
  }

  /**
   * Mark a job's PR as merged
   */
  markMerged(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'done') return undefined;

    job.status = 'merged';
    return job;
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

    for (const job of officeJobs) {
      byStatus[job.status]++;
    }

    return {
      total: officeJobs.length,
      byStatus,
      completionRate: officeJobs.length > 0
        ? ((byStatus.done + byStatus.merged) / officeJobs.length) * 100
        : 0,
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

      const readyJobs = this.getReadyJobs();
      const processing = Array.from(this.jobs.values()).filter(
        (j) => j.status === 'processing'
      ).length;

      // Start jobs up to the parallel limit
      const availableSlots = this.config.maxParallelJobs - processing;
      const toStart = readyJobs.slice(0, availableSlots);

      for (const job of toStart) {
        this.startJob(job.id);
        onJobReady(job).catch((error) => {
          console.error(`Job ${job.id} failed:`, error);
          this.failJob(job.id, error?.message);
        });
      }

      // Schedule next poll
      setTimeout(poll, this.config.pollingInterval);
    };

    poll();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
  }

  private updateDependentJobs(completedJobId: string): void {
    for (const job of this.jobs.values()) {
      if (job.status !== 'pending') continue;
      if (!job.depends_on.includes(completedJobId)) continue;

      // Check if all dependencies are completed
      const allDepsCompleted = job.depends_on.every((depId) => {
        const dep = this.jobs.get(depId);
        return dep && (dep.status === 'done' || dep.status === 'merged');
      });

      if (allDepsCompleted) {
        job.status = 'ready';
      }
    }
  }
}

interface SchedulerStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  completionRate: number;
}
