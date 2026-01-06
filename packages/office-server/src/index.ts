/**
 * Semo Office Server
 *
 * Multi-agent orchestration backend for Semo Office.
 * Handles task decomposition, agent scheduling, and worktree management.
 */

export { createApp } from './api/index.js';
export { TaskDecomposer } from './decomposer/index.js';
export { SessionPool } from './session/pool.js';
export { SessionExecutor } from './session/executor.js';
export { WorktreeManager } from './worktree/manager.js';
export { JobScheduler } from './scheduler/index.js';
export { RealtimeHandler } from './realtime/broadcast.js';

// Database
export * as db from './db/supabase.js';

// Types
export type {
  Office,
  Job,
  AgentPersona,
  Worktree,
  OfficeAgent,
  AgentMessage,
  AgentRole,
  JobStatus,
  WorktreeStatus,
  AgentStatus,
  MessageType,
  DecompositionRequest,
  DecompositionResult,
  DecomposedJob,
  DependencyEdge,
  ProjectContext,
} from './types.js';
