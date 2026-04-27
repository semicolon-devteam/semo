/**
 * Runtime Portable 인터페이스 모음 (P5-0).
 *
 * SEMO 를 Claude / Codex / OpenClaw / Hermes / Ollama 등 특정 모델·호스트에 종속되지 않는
 * 시스템으로 정리하기 위한 4개 인터페이스. 이 단계에서는 타입만 정의하고 구현체 없음.
 *
 * 단계 로드맵: docs/runtime-portable-roadmap.md.
 */

export type {
  HostKind,
  HostCapability,
  HostSessionRef,
  HostAdapter,
  SandboxMode,
  ApprovalPolicy,
} from './host-adapter.js';

export type {
  ToolCallRequest,
  ToolCallResult,
  ToolPermissionPolicy,
  ToolAuditSink,
  ToolGateway,
  ToolDefinition,
} from './tool-gateway.js';

export type {
  ProjectionChannel,
  ProjectionTarget,
  ProjectionPayload,
  ProjectionResult,
  ProjectionEmitter,
} from './projection-emitter.js';

export type {
  HarnessTarget,
  HarnessRunInput,
  HarnessRunResult,
  RuntimeHarness,
} from './runtime-harness.js';

export * from './adapters/index.js';
export * from './emitters/index.js';
export * from './gateways/index.js';
export * from './bridges/index.js';
