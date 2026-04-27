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
  | 'hermes-desktop'
  | 'ollama-cli'
  | 'os-shell'
  | 'mock';

export interface HostCapability {
  /** 파일 시스템 쓰기 권한이 단계적으로 격상 가능한가 (sandbox → workspace-write → dangerous). */
  graduatedFsPermission: boolean;
  /** 호스트가 자체적으로 도구 호출 결과를 후처리하는가 (e.g., Claude Code permission prompt). */
  nativeApprovalPrompt: boolean;
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
}
