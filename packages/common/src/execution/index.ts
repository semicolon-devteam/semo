export type {
  ExecutionTarget,
  TargetKind,
  TargetCapability,
  TargetMessage,
  TargetToolDefinition,
  TargetToolCall,
  TargetDispatchInput,
  TargetDispatchResult,
  TargetHealth,
  TargetConfig,
} from './types.js';

export { MockTarget, type MockTargetOptions } from './mock-target.js';
export { TargetRegistry, defaultRegistry, type TargetFactory } from './registry.js';
export { AnthropicApiTarget } from './anthropic.js';
export { OpenAiTarget } from './openai.js';
export { GeminiTarget } from './gemini.js';
export { OllamaTarget } from './ollama.js';
export { MlxTarget } from './mlx.js';
export {
  ClaudeCodeTarget,
  type ClaudeCodeTargetOptions,
  type SeatStrategy,
} from './claude-code.js';
export type { SeatLike, OperationalStoreLike } from './seat-types.js';
export {
  ModelRegistry,
  setDefaultModelRegistry,
  getDefaultModelRegistry,
  type LogicalModel,
  type ModelCatalog,
  type ModelRegistryOptions,
  type KbStoreLike,
} from './model-registry.js';
export {
  KbAwareTarget,
  type KbAwareOptions,
  type KbSearcher,
  type KbEntryLite,
} from './kb-aware.js';
