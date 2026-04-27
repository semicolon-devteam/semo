/**
 * HookGateway / PolicyEngine — Claude Code lifecycle hook 표준화 인터페이스 (P5-7).
 *
 * ToolGateway 와 분리된 추상화 (KB decision policy-engine-vs-tool-gateway-2026-04-27):
 *   - ToolGateway: LLM 의 tool_use (read_file, run_bash, kb_upsert, ...) wrap
 *   - HookGateway: Claude Code lifecycle (Stop / UserPromptSubmit / PreToolUse / SessionStart) 검증
 *
 * 현재 구현체: packages/cli/src/commands/guard.ts (semo guard run <name>) — 3 guard 등록.
 * 향후 ConsoleAuditSink 와 동일한 PolicyAuditSink 통합 가능.
 */

/** Claude Code hook payload — settings.json 의 hook 이 stdin 으로 전달하는 표준 필드. */
export interface HookPayload {
  /** 봇 또는 세션의 작업 디렉토리. PolicyEngine 이 봇 세션 한정 적용 시 사용. */
  cwd?: string;
  /** Stop hook: 직전 어시스턴트 응답 (string 또는 string[] 변종). */
  last_assistant_message?: string | string[];
  /** 세션 transcript JSONL 절대 경로 (Stop / UserPromptSubmit). */
  transcript_path?: string;
  /** PreToolUse hook: 호출하려는 도구 이름. */
  tool_name?: string;
  /** PreToolUse hook: 도구 인자 (도구별 스키마). */
  tool_input?: Record<string, unknown>;
  /** UserPromptSubmit hook: 사용자가 막 입력한 메시지. */
  user_message?: string;
  /** 추가 필드 (호스트별 확장). */
  [key: string]: unknown;
}

/** Hook 트리거 종류. settings.json 의 키와 매칭. */
export type HookTrigger =
  | 'Stop'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'SessionEnd'
  | 'SubagentStop';

/** Hook 실행 결과. */
export interface HookResult {
  /** stdout 으로 출력될 메시지 (Claude Code 가 사용자/모델에게 표시). */
  message?: string;
  /** exit code. 0 = 통과 (또는 WARN), 1+ = 차단 (Claude Code 가 응답 막음). */
  exitCode: 0 | 1 | 2;
  /** WARN/BLOCK/PASS 등 분류 라벨 (감사 sink 용). */
  level: 'pass' | 'warn' | 'block';
}

/** 단일 guard 정의. */
export interface HookGuard {
  /** Guard 식별자 (`semo guard run <name>` 의 name). */
  name: string;
  /** Guard 가 트리거되는 hook 종류 (settings.json 매핑). */
  triggers: HookTrigger[];
  /** Guard 가 봇 세션에만 적용되는지 (false = 모든 세션). */
  botSessionOnly: boolean;
  /** 한 줄 설명 (semo guard list 출력). */
  description: string;
  /**
   * payload 평가. exit/print 는 호출 측 (HookGateway.runGuard) 책임 — 순수 함수.
   * payload 가 없거나 봇 세션 아닐 때 자체적으로 { exitCode: 0, level: 'pass' } 반환.
   */
  evaluate(payload: HookPayload | null): Promise<HookResult>;
}

/** Guard 호출 이력 영속화 — ToolAuditSink 와 동일 패턴. */
export interface PolicyAuditSink {
  record(guard: string, trigger: HookTrigger, result: HookResult): Promise<void>;
}

/** Guard 등록/조회/실행 단일 진입점. */
export interface HookGateway {
  register(guard: HookGuard): void;
  list(): HookGuard[];
  /**
   * stdin payload 받아 guard 실행. exit/print 는 cli 단에서 처리 (이 인터페이스는
   * 결과만 반환). audit sink 가 등록되어 있으면 기록.
   */
  run(name: string, payload: HookPayload | null): Promise<HookResult>;
}
