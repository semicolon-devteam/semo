/**
 * types.ts 타입 검증 테스트
 *
 * TypeScript 컴파일 시 타입 체크를 통해 검증됨
 */

import type {
  HookEventName,
  SessionStartInput,
  SessionEndInput,
  UserPromptSubmitInput,
  StopInput,
  TranscriptTextEntry,
  TranscriptToolUseEntry,
  TranscriptToolResultEntry,
  InteractionLogInsert,
  SessionUpsert,
} from './types';

describe('type definitions', () => {
  describe('HookEventName', () => {
    it('유효한 hook 이벤트 이름', () => {
      const events: HookEventName[] = [
        'SessionStart',
        'SessionEnd',
        'UserPromptSubmit',
        'Stop',
      ];
      expect(events).toHaveLength(4);
    });
  });

  describe('SessionStartInput', () => {
    it('올바른 구조를 가져야 함', () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/project',
        hook_event_name: 'SessionStart',
        source: 'startup',
        permission_mode: 'default',
      };
      expect(input.hook_event_name).toBe('SessionStart');
      expect(input.source).toBe('startup');
    });
  });

  describe('SessionEndInput', () => {
    it('올바른 구조를 가져야 함', () => {
      const input: SessionEndInput = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/project',
        hook_event_name: 'SessionEnd',
        reason: 'clear',
      };
      expect(input.hook_event_name).toBe('SessionEnd');
      expect(input.reason).toBe('clear');
    });
  });

  describe('UserPromptSubmitInput', () => {
    it('올바른 구조를 가져야 함', () => {
      const input: UserPromptSubmitInput = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/project',
        hook_event_name: 'UserPromptSubmit',
        prompt: '사용자 프롬프트',
      };
      expect(input.hook_event_name).toBe('UserPromptSubmit');
      expect(input.prompt).toBe('사용자 프롬프트');
    });
  });

  describe('StopInput', () => {
    it('올바른 구조를 가져야 함', () => {
      const input: StopInput = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/project',
        hook_event_name: 'Stop',
        stop_hook_active: false,
      };
      expect(input.hook_event_name).toBe('Stop');
    });
  });

  describe('TranscriptEntry types', () => {
    it('TranscriptTextEntry', () => {
      const entry: TranscriptTextEntry = {
        type: 'text',
        role: 'user',
        content: '테스트 메시지',
      };
      expect(entry.type).toBe('text');
    });

    it('TranscriptToolUseEntry', () => {
      const entry: TranscriptToolUseEntry = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'Read',
        input: { file_path: '/test.ts' },
      };
      expect(entry.type).toBe('tool_use');
    });

    it('TranscriptToolResultEntry', () => {
      const entry: TranscriptToolResultEntry = {
        type: 'tool_result',
        tool_use_id: 'toolu_123',
        content: [{ type: 'text', text: 'result' }],
      };
      expect(entry.type).toBe('tool_result');
    });
  });

  describe('InteractionLogInsert', () => {
    it('올바른 구조를 가져야 함', () => {
      const log: InteractionLogInsert = {
        user_id: 'user-uuid',
        session_id: 'session-id',
        agent_id: 'agent-uuid',
        role: 'user',
        content: '테스트 내용',
        skill_name: 'user_prompt',
        skill_args: { key: 'value' },
        metadata: { captured_at: '2024-01-01' },
      };
      expect(log.role).toBe('user');
      expect(log.skill_name).toBe('user_prompt');
    });
  });

  describe('SessionUpsert', () => {
    it('올바른 구조를 가져야 함', () => {
      const session: SessionUpsert = {
        session_id: 'session-id',
        user_id: 'user-uuid',
        cwd: '/project',
        source: 'startup',
        metadata: { started_at: '2024-01-01' },
      };
      expect(session.source).toBe('startup');
    });
  });
});
