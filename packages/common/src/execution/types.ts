const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';
/**
 * ExecutionTarget 추상화 — 봇이 돌아가는 실행 환경의 공통 인터페이스.
 *
 * 현 구현체는 Claude Code 세션뿐이지만, on-device AI/다른 클라우드 LLM/엣지 등
 * 추가 타깃이 같은 인터페이스로 플러그인되도록 한다.
 *
 * Registry SoT: ${DB_SCHEMA}.bot_status.execution_target + target_config.
 */

export type TargetKind =
  | 'claude-code'
  | 'on-device'
  | 'cloud-llm'
  | 'mock'
  | 'anthropic-api'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'mlx';

export interface TargetCapability {
  /** MCP/tool-call 네이티브 지원. false면 프롬프트 기반 폴백 필요. */
  toolUse: boolean;
  streaming: boolean;
  maxContextTokens: number;
  supportsEmbedding: boolean;
  supportsVision: boolean;
  /** flat=정액(구독), metered=종량(API), free=로컬. bot_cost_log 계산 기준. */
  costProfile: 'flat' | 'metered' | 'free';
  offlineCapable: boolean;
}

export interface TargetMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TargetToolDefinition {
  name: string;
  description: string;
  /** JSON schema. */
  inputSchema: Record<string, unknown>;
}

export interface TargetToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface TargetDispatchInput {
  botId: string;
  /** 세션 연속성. Claude Code는 pid 매핑, on-device는 무상태라 ignore 가능. */
  sessionKey: string;
  messages: TargetMessage[];
  tools?: TargetToolDefinition[];
  maxTurns?: number;
  systemPrompt?: string;
}

export interface TargetDispatchResult {
  replyText: string;
  toolCalls?: TargetToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    /** metered 타깃만 채움. free=0, flat=분할 추정 or undefined. */
    costUsd?: number;
  };
  latencyMs: number;
  /** 타깃별 raw 응답 일부(디버깅·감사용). */
  targetMeta: Record<string, unknown>;
}

export interface TargetHealth {
  ok: boolean;
  detail?: string;
}

export interface ExecutionTarget {
  readonly kind: TargetKind;
  readonly capability: TargetCapability;
  dispatch(input: TargetDispatchInput): Promise<TargetDispatchResult>;
  healthCheck(): Promise<TargetHealth>;
  shutdown(): Promise<void>;
}

/**
 * DB `bot_status.target_config` JSONB 스키마.
 * 타깃별 필요한 키는 해당 타깃 어댑터가 해석.
 */
export interface TargetConfig {
  kind: TargetKind;
  /** claude-code: 미사용. on-device: "http://host:11434". cloud-llm: provider endpoint. */
  endpoint?: string;
  /** 타깃 네이티브 모델명 (예: "qwen3:32b", "claude-opus-4-6"). */
  model?: string;
  /** 추가 파라미터 (timeout, keepAlive, temperature 등). */
  params?: Record<string, unknown>;
}
