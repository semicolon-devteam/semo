/**
 * Session Module
 *
 * Re-exports all session-related components.
 */

export { SessionExecutor } from './executor.js';
export type {
  ExecutorConfig,
  ExecutionContext,
  ExecutionResult,
  CommandType,
  AgentCommand,
  AgentCommandResult,
  AgentSession,
} from './executor.js';

export { SessionPool } from './pool.js';
export type {
  PoolConfig,
  CircuitBreakerConfig,
  Session,
  SessionStatus,
  CircuitState,
} from './pool.js';

export { OutputMonitor } from './output-monitor.js';
export type {
  MonitorConfig,
  OutputEntry,
  CompletionResult,
  CompletionReason,
} from './output-monitor.js';

export { PersonaInjector } from './persona-injector.js';
export type {
  InjectorConfig,
  InjectionContext,
  ProjectContext,
  InjectionResult,
} from './persona-injector.js';
