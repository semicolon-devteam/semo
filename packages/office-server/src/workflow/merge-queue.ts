/**
 * Merge Queue
 *
 * Manages PR merge ordering based on job dependencies.
 * Ensures PRs are merged in the correct order to avoid conflicts.
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Job, AgentRole } from '../types.js';

const execAsync = promisify(exec);

export interface MergeQueueConfig {
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Base branch for merges */
  baseBranch: string;
  /** Auto-rebase before merge */
  autoRebase: boolean;
  /** Require passing checks before merge */
  requireChecks: boolean;
  /** Merge method */
  mergeMethod: 'merge' | 'squash' | 'rebase';
  /** Retry failed merges */
  retryOnConflict: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
}

export interface QueuedPR {
  id: string;
  jobId: string;
  prNumber: number;
  branch: string;
  title: string;
  role?: AgentRole;
  dependsOn: string[]; // Job IDs this PR depends on
  status: PRStatus;
  addedAt: Date;
  mergedAt?: Date;
  retryCount: number;
  error?: string;
}

export type PRStatus =
  | 'queued'
  | 'waiting_deps'
  | 'ready'
  | 'merging'
  | 'merged'
  | 'conflict'
  | 'failed';

export interface MergeResult {
  success: boolean;
  prNumber: number;
  commitSha?: string;
  error?: string;
}

const DEFAULT_CONFIG: MergeQueueConfig = {
  owner: '',
  repo: '',
  baseBranch: 'main',
  autoRebase: true,
  requireChecks: true,
  mergeMethod: 'squash',
  retryOnConflict: true,
  maxRetries: 3,
};

export class MergeQueue extends EventEmitter {
  private config: MergeQueueConfig;
  private queue: Map<string, QueuedPR> = new Map();
  private mergedJobs: Set<string> = new Set();
  private processing: boolean = false;
  private processTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MergeQueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Configure repository settings
   */
  configure(owner: string, repo: string, baseBranch: string = 'main'): void {
    this.config.owner = owner;
    this.config.repo = repo;
    this.config.baseBranch = baseBranch;
  }

  /**
   * Add a PR to the merge queue
   */
  async addToQueue(
    job: Job,
    prNumber: number,
    branch: string,
    title: string,
    role?: AgentRole
  ): Promise<QueuedPR> {
    const queuedPR: QueuedPR = {
      id: `pr-${prNumber}`,
      jobId: job.id,
      prNumber,
      branch,
      title,
      role,
      dependsOn: job.depends_on || [],
      status: 'queued',
      addedAt: new Date(),
      retryCount: 0,
    };

    // Check if dependencies are satisfied
    const depsSatisfied = this.checkDependencies(queuedPR);
    queuedPR.status = depsSatisfied ? 'ready' : 'waiting_deps';

    this.queue.set(queuedPR.id, queuedPR);
    this.emit('added', { pr: queuedPR });

    // Trigger processing
    this.scheduleProcessing();

    return queuedPR;
  }

  /**
   * Mark a job as merged (for dependency tracking)
   */
  markJobMerged(jobId: string): void {
    this.mergedJobs.add(jobId);

    // Update waiting PRs
    for (const pr of this.queue.values()) {
      if (pr.status === 'waiting_deps') {
        if (this.checkDependencies(pr)) {
          pr.status = 'ready';
          this.emit('ready', { pr });
        }
      }
    }

    // Trigger processing
    this.scheduleProcessing();
  }

  /**
   * Process the merge queue
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Get ready PRs sorted by dependency order
      const readyPRs = this.getReadyPRs();

      for (const pr of readyPRs) {
        // Check if still ready (state might have changed)
        if (pr.status !== 'ready') continue;

        // Attempt merge
        const result = await this.mergePR(pr);

        if (result.success) {
          pr.status = 'merged';
          pr.mergedAt = new Date();
          this.mergedJobs.add(pr.jobId);
          this.emit('merged', { pr, commitSha: result.commitSha });

          // Update dependent PRs
          this.updateDependentPRs(pr.jobId);
        } else if (result.error?.includes('conflict')) {
          pr.status = 'conflict';
          pr.error = result.error;

          if (this.config.retryOnConflict && pr.retryCount < this.config.maxRetries) {
            // Attempt rebase and retry
            const rebaseResult = await this.rebasePR(pr);
            if (rebaseResult.success) {
              pr.status = 'ready';
              pr.retryCount++;
              this.emit('rebased', { pr });
            } else {
              this.emit('conflictFailed', { pr, error: rebaseResult.error });
            }
          } else {
            this.emit('conflictFailed', { pr, error: result.error });
          }
        } else {
          pr.status = 'failed';
          pr.error = result.error;
          this.emit('failed', { pr, error: result.error });
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get PRs ready for merge
   */
  getReadyPRs(): QueuedPR[] {
    const ready: QueuedPR[] = [];

    for (const pr of this.queue.values()) {
      if (pr.status === 'ready') {
        ready.push(pr);
      }
    }

    // Sort by dependency order (PRs with fewer deps first)
    return ready.sort((a, b) => a.dependsOn.length - b.dependsOn.length);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    const prs = Array.from(this.queue.values());

    return {
      total: prs.length,
      byStatus: {
        queued: prs.filter((p) => p.status === 'queued').length,
        waiting_deps: prs.filter((p) => p.status === 'waiting_deps').length,
        ready: prs.filter((p) => p.status === 'ready').length,
        merging: prs.filter((p) => p.status === 'merging').length,
        merged: prs.filter((p) => p.status === 'merged').length,
        conflict: prs.filter((p) => p.status === 'conflict').length,
        failed: prs.filter((p) => p.status === 'failed').length,
      },
      mergedJobs: this.mergedJobs.size,
    };
  }

  /**
   * Get PR by job ID
   */
  getPRByJob(jobId: string): QueuedPR | undefined {
    for (const pr of this.queue.values()) {
      if (pr.jobId === jobId) {
        return pr;
      }
    }
    return undefined;
  }

  /**
   * Remove PR from queue
   */
  removePR(prId: string): void {
    this.queue.delete(prId);
    this.emit('removed', { prId });
  }

  /**
   * Retry a failed PR
   */
  async retryPR(prId: string): Promise<boolean> {
    const pr = this.queue.get(prId);
    if (!pr || (pr.status !== 'failed' && pr.status !== 'conflict')) {
      return false;
    }

    pr.status = 'ready';
    pr.error = undefined;
    pr.retryCount++;

    this.scheduleProcessing();
    return true;
  }

  /**
   * Clear merged PRs from queue
   */
  clearMerged(): number {
    let count = 0;
    for (const [id, pr] of this.queue) {
      if (pr.status === 'merged') {
        this.queue.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }

  private checkDependencies(pr: QueuedPR): boolean {
    return pr.dependsOn.every((depId) => this.mergedJobs.has(depId));
  }

  private updateDependentPRs(mergedJobId: string): void {
    for (const pr of this.queue.values()) {
      if (pr.status === 'waiting_deps' && pr.dependsOn.includes(mergedJobId)) {
        if (this.checkDependencies(pr)) {
          pr.status = 'ready';
          this.emit('ready', { pr });
        }
      }
    }
  }

  private scheduleProcessing(): void {
    if (this.processTimer) return;

    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      this.processQueue().catch((error) => {
        console.error('Queue processing error:', error);
      });
    }, 1000); // 1 second debounce
  }

  private async mergePR(pr: QueuedPR): Promise<MergeResult> {
    const { owner, repo, baseBranch, mergeMethod, requireChecks, autoRebase } = this.config;

    if (!owner || !repo) {
      return { success: false, prNumber: pr.prNumber, error: 'Repository not configured' };
    }

    pr.status = 'merging';
    this.emit('merging', { pr });

    try {
      // Check PR status
      const statusResult = await execAsync(
        `gh pr view ${pr.prNumber} --repo ${owner}/${repo} --json mergeable,mergeStateStatus,statusCheckRollup`
      );
      const prStatus = JSON.parse(statusResult.stdout);

      // Check if mergeable
      if (prStatus.mergeable === 'CONFLICTING') {
        return {
          success: false,
          prNumber: pr.prNumber,
          error: 'PR has conflicts',
        };
      }

      // Check status checks
      if (requireChecks && prStatus.mergeStateStatus !== 'CLEAN') {
        const failedChecks = prStatus.statusCheckRollup?.filter(
          (c: { state: string }) => c.state !== 'SUCCESS'
        );
        if (failedChecks?.length > 0) {
          return {
            success: false,
            prNumber: pr.prNumber,
            error: `Checks failed: ${failedChecks.map((c: { name: string }) => c.name).join(', ')}`,
          };
        }
      }

      // Auto-rebase if needed
      if (autoRebase && prStatus.mergeStateStatus === 'BEHIND') {
        const rebaseResult = await this.rebasePR(pr);
        if (!rebaseResult.success) {
          return rebaseResult;
        }
      }

      // Merge the PR
      const mergeResult = await execAsync(
        `gh pr merge ${pr.prNumber} --repo ${owner}/${repo} --${mergeMethod} --auto`
      );

      // Extract commit SHA from result
      const shaMatch = mergeResult.stdout.match(/([a-f0-9]{40})/);
      const commitSha = shaMatch ? shaMatch[1] : undefined;

      return {
        success: true,
        prNumber: pr.prNumber,
        commitSha,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        prNumber: pr.prNumber,
        error: message,
      };
    }
  }

  private async rebasePR(pr: QueuedPR): Promise<MergeResult> {
    const { owner, repo, baseBranch } = this.config;

    try {
      // Update PR branch
      await execAsync(
        `gh pr update-branch ${pr.prNumber} --repo ${owner}/${repo} --rebase`
      );

      return { success: true, prNumber: pr.prNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rebase failed';
      return {
        success: false,
        prNumber: pr.prNumber,
        error: message.includes('conflict') ? 'Rebase conflict' : message,
      };
    }
  }
}

interface QueueStatus {
  total: number;
  byStatus: Record<PRStatus, number>;
  mergedJobs: number;
}
