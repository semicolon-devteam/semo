/**
 * transcript.ts 단위 테스트
 */

import {
  getLastAssistantResponse,
  getLastUserPrompt,
  getTextEntries,
  calculateSessionStats,
} from './transcript';
import type { TranscriptEntry, TranscriptTextEntry } from './types';

describe('transcript parser', () => {
  const mockEntries: TranscriptEntry[] = [
    { type: 'text', role: 'user', content: '첫 번째 사용자 메시지' },
    { type: 'text', role: 'assistant', content: '첫 번째 어시스턴트 응답' },
    { type: 'tool_use', id: 'toolu_01', name: 'Read', input: { file_path: '/test.ts' } },
    { type: 'tool_result', tool_use_id: 'toolu_01', content: [{ type: 'text', text: 'file content' }] },
    { type: 'text', role: 'user', content: '두 번째 사용자 메시지' },
    { type: 'text', role: 'assistant', content: '두 번째 어시스턴트 응답' },
  ];

  describe('getLastAssistantResponse', () => {
    it('마지막 assistant 응답을 반환해야 함', () => {
      const result = getLastAssistantResponse(mockEntries);
      expect(result).toBe('두 번째 어시스턴트 응답');
    });

    it('assistant 응답이 없으면 null 반환', () => {
      const entries: TranscriptEntry[] = [
        { type: 'text', role: 'user', content: '사용자 메시지' },
      ];
      const result = getLastAssistantResponse(entries);
      expect(result).toBeNull();
    });

    it('빈 배열이면 null 반환', () => {
      const result = getLastAssistantResponse([]);
      expect(result).toBeNull();
    });
  });

  describe('getLastUserPrompt', () => {
    it('마지막 user 프롬프트를 반환해야 함', () => {
      const result = getLastUserPrompt(mockEntries);
      expect(result).toBe('두 번째 사용자 메시지');
    });

    it('user 프롬프트가 없으면 null 반환', () => {
      const entries: TranscriptEntry[] = [
        { type: 'text', role: 'assistant', content: '어시스턴트 응답' },
      ];
      const result = getLastUserPrompt(entries);
      expect(result).toBeNull();
    });
  });

  describe('getTextEntries', () => {
    it('text 타입 엔트리만 필터링해야 함', () => {
      const result = getTextEntries(mockEntries);
      expect(result).toHaveLength(4);
      result.forEach((entry) => {
        expect(entry.type).toBe('text');
      });
    });

    it('빈 배열이면 빈 배열 반환', () => {
      const result = getTextEntries([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateSessionStats', () => {
    it('세션 통계를 올바르게 계산해야 함', () => {
      const result = calculateSessionStats(mockEntries);
      expect(result).toEqual({
        totalMessages: 4,
        userMessages: 2,
        assistantMessages: 2,
        toolUses: 1,
      });
    });

    it('빈 배열이면 모든 값이 0', () => {
      const result = calculateSessionStats([]);
      expect(result).toEqual({
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        toolUses: 0,
      });
    });

    it('tool_use만 있는 경우', () => {
      const entries: TranscriptEntry[] = [
        { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
        { type: 'tool_use', id: 'toolu_02', name: 'Write', input: {} },
      ];
      const result = calculateSessionStats(entries);
      expect(result).toEqual({
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        toolUses: 2,
      });
    });
  });
});
