/**
 * semo-hooks 타입 정의
 */

/**
 * Hook 이벤트 이름
 */
export type HookEventName =
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'Stop';

/**
 * SessionStart source 타입
 */
export type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact';

/**
 * SessionEnd reason 타입
 */
export type SessionEndReason = 'clear' | 'logout' | 'prompt_input_exit' | 'other';

/**
 * 기본 Hook 입력 구조
 */
export interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: HookEventName;
}

/**
 * SessionStart Hook 입력
 */
export interface SessionStartInput extends BaseHookInput {
  hook_event_name: 'SessionStart';
  source: SessionStartSource;
  permission_mode?: string;
}

/**
 * SessionEnd Hook 입력
 */
export interface SessionEndInput extends BaseHookInput {
  hook_event_name: 'SessionEnd';
  reason: SessionEndReason;
}

/**
 * UserPromptSubmit Hook 입력
 */
export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

/**
 * Stop Hook 입력
 */
export interface StopInput extends BaseHookInput {
  hook_event_name: 'Stop';
  stop_hook_active?: boolean;
}

/**
 * 모든 Hook 입력 타입 유니온
 */
export type HookInput =
  | SessionStartInput
  | SessionEndInput
  | UserPromptSubmitInput
  | StopInput;

/**
 * SessionStart Hook 출력
 */
export interface SessionStartOutput {
  hookSpecificOutput?: {
    hookEventName: 'SessionStart';
    additionalContext?: string;
  };
}

/**
 * Transcript JSONL 엔트리 타입
 */
export type TranscriptEntryType = 'text' | 'tool_use' | 'tool_result';

/**
 * Transcript 텍스트 엔트리
 */
export interface TranscriptTextEntry {
  type: 'text';
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Transcript 도구 사용 엔트리
 */
export interface TranscriptToolUseEntry {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Transcript 도구 결과 엔트리
 */
export interface TranscriptToolResultEntry {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown[];
}

/**
 * Transcript 엔트리 유니온
 */
export type TranscriptEntry =
  | TranscriptTextEntry
  | TranscriptToolUseEntry
  | TranscriptToolResultEntry;

/**
 * interaction_logs 테이블 insert 타입
 */
export interface InteractionLogInsert {
  user_id: string;
  session_id: string;
  agent_id: string;
  role: 'user' | 'assistant';
  content: string;
  skill_name: string;
  skill_args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * sessions 테이블 upsert 타입
 */
export interface SessionUpsert {
  session_id: string;
  user_id: string;
  cwd: string;
  started_at?: Date;
  ended_at?: Date;
  source?: SessionStartSource;
  end_reason?: SessionEndReason;
  metadata?: Record<string, unknown>;
}
