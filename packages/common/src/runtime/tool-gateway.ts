/**
 * ToolGateway — LLM 도구 호출 단일 진입점.
 *
 * 봇이 호출하는 도구(read_file, run_bash, kb_upsert, ...)는 호스트마다 권한 모델이 다르다
 * (Claude Code permission mode, Codex sandbox 단계, Ollama no-sandbox). ToolGateway 가 그 차이를
 * 흡수하고, 모든 도구 호출을 동일한 권한 체크 / 감사 로그 / Cancel-Timeout 루프 안에 둔다.
 *
 * 현 코드에서 `~/.semo/shared/hooks/` 가 ad-hoc 으로 처리하는 권한·로깅을 코어로 끌어올리는 자리.
 * 구현체는 P5-3 에서 도입.
 */

import type { HostAdapter, HostSessionRef } from './host-adapter.js';

export interface ToolCallRequest {
  /** 도구 이름 (e.g., 'read_file', 'run_bash', 'kb_upsert'). */
  name: string;
  arguments: Record<string, unknown>;
  /** 호출 주체 (보통 botId). */
  callerId: string;
  /** 호스트 세션 컨텍스트. 권한 단계 평가에 사용. */
  hostSession: HostSessionRef;
}

export interface ToolCallResult {
  ok: boolean;
  /** 성공 시 호출 결과(JSON-serializable). */
  output?: unknown;
  /** 실패 시 사유. */
  error?: string;
  /** 권한 거부 시 어떤 단계가 부족했는지 명시. */
  permissionRequired?: 'workspace-write' | 'network' | 'dangerous';
  /** 도구 실행에 걸린 시간. */
  durationMs: number;
}

export interface ToolPermissionPolicy {
  /** 해당 도구의 호출 허용 여부를 결정. 거부 시 permissionRequired 명시. */
  evaluate(
    req: ToolCallRequest,
  ): Promise<{ allow: boolean; permissionRequired?: ToolCallResult['permissionRequired'] }>;
}

export interface ToolAuditSink {
  /** 모든 호출 결과를 영속화. 감사·롤백·중복 호출 감지에 활용. */
  record(req: ToolCallRequest, res: ToolCallResult): Promise<void>;
}

/**
 * 도구 정의 — bridge (Codex MCP, Claude tool_use 등) 용 메타데이터.
 * register(definition, handler) 형식으로 등록 시 listDefinitions() 에 노출.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON schema (input). */
  inputSchema: Record<string, unknown>;
}

export interface ToolGateway {
  readonly host: HostAdapter;
  /**
   * 도구 호출 디스패치. 권한 평가 → 호스트 sandbox 매핑 → 실행 → 감사 로그.
   */
  invoke(req: ToolCallRequest): Promise<ToolCallResult>;
  /**
   * 도구 등록. 두 시그니처 지원 (P5-4b):
   *   register(name, handler) — bridge 노출 X (P5-3a 호환).
   *   register(definition, handler) — bridge 메타데이터 포함, listDefinitions() 에 노출.
   */
  register(name: string, handler: (req: ToolCallRequest) => Promise<unknown>): void;
  register(definition: ToolDefinition, handler: (req: ToolCallRequest) => Promise<unknown>): void;
  /**
   * 등록된 도구 정의 목록 (definition 형태로 등록된 것만).
   * Codex MCP / Claude tool_use 변환 등 bridge 에서 사용.
   */
  listDefinitions(): ToolDefinition[];
}
