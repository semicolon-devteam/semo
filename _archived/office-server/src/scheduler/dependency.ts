/**
 * Dependency Resolver
 *
 * Manages job dependencies and determines execution readiness.
 */

import { EventEmitter } from 'events';
import type { Job, JobStatus } from '../types.js';

export interface DependencyNode {
  jobId: string;
  dependsOn: string[];
  dependents: string[];
  status: JobStatus;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  executionOrder: string[][];
}

export class DependencyResolver extends EventEmitter {
  private nodes: Map<string, DependencyNode> = new Map();
  private completedJobs: Set<string> = new Set();

  /**
   * Add a job to the dependency graph
   */
  addJob(job: Job): void {
    const node: DependencyNode = {
      jobId: job.id,
      dependsOn: job.depends_on || [],
      dependents: [],
      status: job.status,
    };

    this.nodes.set(job.id, node);

    // Update reverse dependencies
    for (const depId of node.dependsOn) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(job.id);
      }
    }

    this.emit('jobAdded', { jobId: job.id, dependencies: node.dependsOn });
  }

  /**
   * Remove a job from the dependency graph
   */
  removeJob(jobId: string): void {
    const node = this.nodes.get(jobId);
    if (!node) return;

    // Remove from dependents' dependsOn
    for (const depId of node.dependsOn) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents = depNode.dependents.filter((id) => id !== jobId);
      }
    }

    // Remove from dependencies' dependents
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode) {
        dependentNode.dependsOn = dependentNode.dependsOn.filter(
          (id) => id !== jobId
        );
      }
    }

    this.nodes.delete(jobId);
    this.completedJobs.delete(jobId);
  }

  /**
   * Mark a job as completed
   */
  markCompleted(jobId: string): string[] {
    const node = this.nodes.get(jobId);
    if (!node) return [];

    node.status = 'done';
    this.completedJobs.add(jobId);

    // Find newly ready jobs
    const readyJobs: string[] = [];

    for (const dependentId of node.dependents) {
      if (this.isReady(dependentId)) {
        readyJobs.push(dependentId);
        const dependentNode = this.nodes.get(dependentId);
        if (dependentNode) {
          dependentNode.status = 'ready';
        }
      }
    }

    if (readyJobs.length > 0) {
      this.emit('jobsReady', { jobIds: readyJobs, triggeredBy: jobId });
    }

    return readyJobs;
  }

  /**
   * Mark a job as failed
   */
  markFailed(jobId: string): string[] {
    const node = this.nodes.get(jobId);
    if (!node) return [];

    node.status = 'failed';

    // Cascade failure to dependents
    const blockedJobs = this.cascadeFailure(jobId);

    if (blockedJobs.length > 0) {
      this.emit('jobsBlocked', { jobIds: blockedJobs, blockedBy: jobId });
    }

    return blockedJobs;
  }

  /**
   * Check if a job is ready to execute
   */
  isReady(jobId: string): boolean {
    const node = this.nodes.get(jobId);
    if (!node) return false;

    // Already processing or completed
    if (node.status !== 'pending' && node.status !== 'ready') {
      return false;
    }

    // Check all dependencies are completed
    return node.dependsOn.every((depId) => this.completedJobs.has(depId));
  }

  /**
   * Get all ready jobs
   */
  getReadyJobs(): string[] {
    const ready: string[] = [];

    for (const [jobId, node] of this.nodes) {
      if (node.status === 'ready' || (node.status === 'pending' && this.isReady(jobId))) {
        ready.push(jobId);
      }
    }

    return ready;
  }

  /**
   * Get jobs blocked by a failed job
   */
  getBlockedJobs(failedJobId: string): string[] {
    const blocked: string[] = [];
    const visited = new Set<string>();

    const traverse = (jobId: string) => {
      const node = this.nodes.get(jobId);
      if (!node || visited.has(jobId)) return;
      visited.add(jobId);

      for (const dependentId of node.dependents) {
        blocked.push(dependentId);
        traverse(dependentId);
      }
    };

    traverse(failedJobId);
    return blocked;
  }

  /**
   * Build execution order (topological sort)
   */
  buildExecutionOrder(): string[][] {
    const groups: string[][] = [];
    const remaining = new Set(this.nodes.keys());
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const currentGroup: string[] = [];

      for (const jobId of remaining) {
        const node = this.nodes.get(jobId)!;
        const allDepsCompleted = node.dependsOn.every((dep) =>
          completed.has(dep)
        );

        if (allDepsCompleted) {
          currentGroup.push(jobId);
        }
      }

      if (currentGroup.length === 0 && remaining.size > 0) {
        // Circular dependency detected
        this.emit('circularDependency', {
          jobs: Array.from(remaining),
        });
        break;
      }

      for (const jobId of currentGroup) {
        completed.add(jobId);
        remaining.delete(jobId);
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }

    return groups;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (jobId: string): boolean => {
      if (recursionStack.has(jobId)) {
        // Found cycle
        const cycleStart = path.indexOf(jobId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return true;
      }

      if (visited.has(jobId)) return false;

      visited.add(jobId);
      recursionStack.add(jobId);
      path.push(jobId);

      const node = this.nodes.get(jobId);
      if (node) {
        for (const depId of node.dependsOn) {
          dfs(depId);
        }
      }

      path.pop();
      recursionStack.delete(jobId);
      return false;
    };

    for (const jobId of this.nodes.keys()) {
      if (!visited.has(jobId)) {
        dfs(jobId);
      }
    }

    return cycles;
  }

  /**
   * Get dependency graph statistics
   */
  getStats(): DependencyStats {
    let totalDependencies = 0;
    let maxDepth = 0;

    for (const node of this.nodes.values()) {
      totalDependencies += node.dependsOn.length;
    }

    // Calculate max depth
    const depths = new Map<string, number>();
    const calculateDepth = (jobId: string): number => {
      if (depths.has(jobId)) return depths.get(jobId)!;

      const node = this.nodes.get(jobId);
      if (!node || node.dependsOn.length === 0) {
        depths.set(jobId, 0);
        return 0;
      }

      const depth = 1 + Math.max(
        ...node.dependsOn.map((dep) => calculateDepth(dep))
      );
      depths.set(jobId, depth);
      return depth;
    };

    for (const jobId of this.nodes.keys()) {
      maxDepth = Math.max(maxDepth, calculateDepth(jobId));
    }

    return {
      totalJobs: this.nodes.size,
      completedJobs: this.completedJobs.size,
      totalDependencies,
      maxDepth,
      readyJobs: this.getReadyJobs().length,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.nodes.clear();
    this.completedJobs.clear();
  }

  private cascadeFailure(jobId: string): string[] {
    const blocked: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      const node = this.nodes.get(currentId);
      if (!node || visited.has(currentId)) return;
      visited.add(currentId);

      for (const dependentId of node.dependents) {
        blocked.push(dependentId);
        const dependentNode = this.nodes.get(dependentId);
        if (dependentNode) {
          dependentNode.status = 'failed';
        }
        traverse(dependentId);
      }
    };

    traverse(jobId);
    return blocked;
  }
}

interface DependencyStats {
  totalJobs: number;
  completedJobs: number;
  totalDependencies: number;
  maxDepth: number;
  readyJobs: number;
}
