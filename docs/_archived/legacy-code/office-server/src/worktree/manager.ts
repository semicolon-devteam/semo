/**
 * Worktree Manager
 *
 * Manages Git worktrees for agent isolation.
 * Each agent gets its own worktree to work in parallel without conflicts.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { join } from 'path';
import type { AgentRole, Worktree, WorktreeStatus } from '../types.js';

export interface CreateWorktreeOptions {
  officeId: string;
  repoPath: string;
  agentRole: AgentRole;
  branchName?: string;
  baseBranch?: string;
}

export interface RemoveWorktreeOptions {
  worktreePath: string;
  force?: boolean;
}

export class WorktreeManager {
  /**
   * Create a new worktree for an agent
   */
  async createWorktree(options: CreateWorktreeOptions): Promise<Worktree> {
    const { officeId, repoPath, agentRole, baseBranch = 'main' } = options;

    const git: SimpleGit = simpleGit(repoPath);

    // Generate branch name if not provided
    const branchName =
      options.branchName ?? `feature/${agentRole.toLowerCase()}-${Date.now()}`;

    // Worktree path: {repo}/agent/{role}
    const worktreePath = join(repoPath, 'agent', agentRole.toLowerCase());

    // Ensure agent directory exists
    await git.raw(['worktree', 'add', worktreePath, '-b', branchName, baseBranch]);

    const worktree: Worktree = {
      id: `wt-${agentRole}-${Date.now()}`,
      office_id: officeId,
      agent_role: agentRole,
      path: worktreePath,
      branch: branchName,
      status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return worktree;
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(options: RemoveWorktreeOptions): Promise<boolean> {
    const { worktreePath, force = false } = options;

    // Get parent repo path
    const parentPath = join(worktreePath, '..', '..');
    const git: SimpleGit = simpleGit(parentPath);

    try {
      // Check for uncommitted changes
      const worktreeGit: SimpleGit = simpleGit(worktreePath);
      const status = await worktreeGit.status();

      if (!status.isClean() && !force) {
        throw new Error(
          `Worktree has uncommitted changes. Use force=true to remove anyway.`
        );
      }

      // Remove worktree
      const removeArgs = ['worktree', 'remove', worktreePath];
      if (force) {
        removeArgs.push('--force');
      }

      await git.raw(removeArgs);

      // Prune worktree references
      await git.raw(['worktree', 'prune']);

      return true;
    } catch (error) {
      console.error('Failed to remove worktree:', error);
      return false;
    }
  }

  /**
   * List all worktrees for a repository
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    const git: SimpleGit = simpleGit(repoPath);
    const output = await git.raw(['worktree', 'list', '--porcelain']);

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      } else if (line === 'bare') {
        current.bare = true;
      } else if (line === 'detached') {
        current.detached = true;
      }
    }

    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }

    return worktrees;
  }

  /**
   * Get worktree status
   */
  async getWorktreeStatus(worktreePath: string): Promise<WorktreeStatusInfo> {
    const git: SimpleGit = simpleGit(worktreePath);

    const [status, branch] = await Promise.all([
      git.status(),
      git.revparse(['--abbrev-ref', 'HEAD']),
    ]);

    return {
      path: worktreePath,
      branch: branch.trim(),
      isClean: status.isClean(),
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      staged: status.staged,
      ahead: status.ahead,
      behind: status.behind,
    };
  }

  /**
   * Sync worktree with base branch
   */
  async syncWorktree(
    worktreePath: string,
    baseBranch: string = 'main',
    strategy: 'rebase' | 'merge' = 'rebase'
  ): Promise<SyncResult> {
    const git: SimpleGit = simpleGit(worktreePath);

    try {
      // Fetch latest
      await git.fetch('origin', baseBranch);

      if (strategy === 'rebase') {
        await git.rebase([`origin/${baseBranch}`]);
      } else {
        await git.merge([`origin/${baseBranch}`]);
      }

      return { success: true, strategy };
    } catch (error) {
      // Abort on conflict
      if (strategy === 'rebase') {
        await git.rebase(['--abort']);
      } else {
        await git.merge(['--abort']);
      }

      return {
        success: false,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
}

interface WorktreeStatusInfo {
  path: string;
  branch: string;
  isClean: boolean;
  modified: string[];
  created: string[];
  deleted: string[];
  staged: string[];
  ahead: number;
  behind: number;
}

interface SyncResult {
  success: boolean;
  strategy: 'rebase' | 'merge';
  error?: string;
}
