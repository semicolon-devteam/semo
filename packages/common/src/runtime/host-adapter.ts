/**
 * HostAdapter — 실행 호스트(Claude Code CLI / Codex CLI / Hermes desktop / OS shell / ...) 캡슐화.
 *
 * ExecutionTarget(LLM 모델 호출 어댑터)과 분리된 개념. ExecutionTarget 이 "어떤 모델을 부르는가"
 * 라면 HostAdapter 는 "어떤 런타임 환경에서 봇이 살아있는가" 를 다룬다.
 *
 * 같은 `ollama` ExecutionTarget 이라도 Claude Code CLI 안에서 호출되는 경우와 Codex CLI 안에서
 * 호출되는 경우는 sandbox/approval, 세션 resume, 파일 권한 모델이 다르므로 어댑터 분리가 필요하다.
 *
 * 구현체는 P5-1(ClaudeCodeAdapter), P5-4(CodexAdapter), P5-5(Ollama/Hermes stub)에서 추가.
 */

export type HostKind =
  | 'claude-code'
  | 'codex-cli'
  | 'hermes-cli'
  | 'hermes-desktop'
  | 'ollama-cli'
  | 'openclaw'
  | 'os-shell'
  | 'mock';

/** 호스트가 지원하는 파일/명령 권한 단계. ToolGateway 권한 매핑의 기준. */
export type SandboxMode = 'read-only' | 'workspace-write' | 'network' | 'dangerous';

/** 도구 호출 승인 정책. */
export type ApprovalPolicy =
  | 'always-ask' /** 모든 도구 호출에 사용자 승인 (Claude Code 기본). */
  | 'on-write' /** 파일 변경/네트워크 호출에만 승인 (Codex workspace-write 기본). */
  | 'never'; /** 자동 승인 (Codex dangerous, Ollama 로컬). */

export interface HostCapability {
  /** 호스트가 지원하는 sandbox 단계. ToolGateway 가 이 안에서만 권한 격상 가능. */
  sandboxModes: SandboxMode[];
  /** 호스트의 도구 호출 승인 정책. */
  approvalPolicy: ApprovalPolicy;
  /** 세션 ID 기반 resume 지원. */
  sessionResume: boolean;
  /** stdin 으로 prompt 받고 stdout 으로 결과 내보내는 1-shot 모드 지원. */
  oneShotIO: boolean;
  /** 봇이 백그라운드 데몬으로 상주 가능. */
  daemonMode: boolean;
}

export interface HostSessionRef {
  /** 호스트 고유 세션 식별자 (Claude Code session pid, Codex session uuid, ...). */
  hostSessionId: string;
  /** 세션 상태 직렬화 위치 (Codex rollout 파일, Claude session-state.json, ...). */
  rolloutPath?: string;
}

/**
 * P6-0: 호스트에 단일 prompt 를 보내고 결과를 받는 단위 호출.
 *
 * RuntimeHarness 가 한 turn 의 LLM 호출을 위임할 때 사용. 실제 LLM 호출은
 * ExecutionTarget 이 담당하지만, 호스트 환경 (sandbox/세션 컨텍스트/파일 접근) 안에서
 * 실행되어야 하므로 dispatch 는 HostAdapter 의 책임이다.
 *
 * stub: 모든 Adapter 가 현재 unimplemented (`throw new Error('dispatch not wired')`).
 * P6-1 (ClaudeCodeAdapter wiring) 부터 단계적으로 실 호출 wiring.
 */
/**
 * 메시지 출처 채널 메타. Slack/Discord/CLI 등 자주 쓰이는 키만 typed 로 노출하고,
 * 호스트 특화 필드는 context 에 둔다. (Codex P6-0 review 권고)
 */
export interface HostDispatchChannel {
  /** 출처 플랫폼 — slack / discord / github / cli / cron / mock 등. */
  platform: string;
  /** 채널/룸/스레드 부모 식별자 (slack channel id, discord channel id). */
  channelId?: string;
  /** 스레드 식별자 (slack thread_ts, discord thread id). */
  threadId?: string;
  /** 발신자 식별자 (slack user id, discord user id, github actor 등). */
  userId?: string;
}

export interface HostDispatchInput {
  /** 봇/세션 식별자. */
  botId: string;
  /** 호스트 세션 컨텍스트. resume 시 prior session 사용. */
  session: HostSessionRef;
  /** 사용자 prompt 또는 inbox 메시지 본문. */
  prompt: string;
  /** 메시지 출처 채널 메타 (라우팅·감사·reply targeting 용). */
  channel?: HostDispatchChannel;
  /** 추가 컨텍스트 (KB lookup 결과, mailbox 메타 등 — channel 외 자유 필드). */
  context?: Record<string, unknown>;
  /** 호출 cwd (Adapter 별 특화 — Claude Code 는 봇 세션 디렉토리). */
  cwd?: string;
  /** 호출 timeout (ms). 0 또는 undefined 면 호스트 기본값. */
  timeoutMs?: number;
  /**
   * 호출 단위 max budget USD (호스트가 하드 캡 강제). 0/undefined 면 호스트 기본.
   * 운영 budget 차단의 1차 방어선은 RuntimeHarness 가 가진다 — 본 필드는 2차 방어용.
   */
  maxBudgetUsd?: number;
  /**
   * 강제 취소용 AbortSignal. abort() 호출 시 어댑터가 즉시 자식 프로세스를 SIGTERM → SIGKILL.
   * RuntimeHarness.cancel 이 이 신호를 통해 진행 중 dispatch 종료 (Codex P6-2/3/4 review 권고).
   */
  signal?: AbortSignal;
}

export interface HostDispatchResult {
  /** 호스트가 반환한 응답 텍스트 (마지막 turn). */
  text: string;
  /** 호출 후 갱신된 세션 참조 (resume 용). */
  session: HostSessionRef;
  /** 호출 동안 변경된 파일 목록 (CodexAdapter trackFileChanges 등). */
  filesChanged?: string[];
  /** 호출 도중 발생한 도구 호출 횟수 (audit 용). */
  toolCallCount?: number;
  /** 종료 사유 — 'completed' / 'cancelled' / 'timeout' / 'error'. */
  endReason: 'completed' | 'cancelled' | 'timeout' | 'error';
  /** 호스트 raw 응답 일부 (디버깅·감사). */
  hostMeta?: Record<string, unknown>;
}

export interface HostAdapter {
  readonly kind: HostKind;
  readonly capability: HostCapability;

  /**
   * 호스트 환경 사전 점검. doctor 체크리스트에 노출.
   */
  probe(): Promise<{ ok: boolean; detail?: string }>;

  /**
   * 새 세션을 호스트에서 시작. 결과로 호스트 세션 식별자 반환.
   */
  startSession(input: { botId: string; workspacePath?: string }): Promise<HostSessionRef>;

  /**
   * 기존 세션 재개 (호스트가 sessionResume 지원하는 경우만).
   */
  resumeSession(ref: HostSessionRef): Promise<void>;

  /**
   * 세션 종료 — 호스트 리소스 정리.
   */
  endSession(ref: HostSessionRef): Promise<void>;

  /**
   * P6-0: 단일 prompt 호출 (실 LLM 호출 wrapper).
   * 현 stub 단계에서 모든 Adapter 가 `throw new Error('dispatch not wired')`.
   * P6-1 부터 ClaudeCodeAdapter 실 wiring → CodexAdapter / OllamaAdapter / OpenClawAdapter.
   */
  dispatch(input: HostDispatchInput): Promise<HostDispatchResult>;
}
