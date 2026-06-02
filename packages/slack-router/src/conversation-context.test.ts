import { describe, it, expect } from 'vitest';
import { buildConversationContextBlock } from './conversation-context';

type H = { display_name: string; text: string; is_bot: boolean };

describe('buildConversationContextBlock', () => {
  it('히스토리가 모두 비면 빈 문자열', () => {
    expect(buildConversationContextBlock([], [])).toBe('');
  });

  it('스레드 히스토리를 라벨과 함께 렌더', () => {
    const thread: H[] = [{ display_name: 'Mark', text: '안녕', is_bot: false }];
    const out = buildConversationContextBlock(thread, []);
    expect(out).toContain('# 이 스레드의 이전 대화');
    expect(out).toContain('- Mark: 안녕');
  });

  it('봇 메시지는 (봇) 표시', () => {
    const ch: H[] = [{ display_name: 'Semi', text: '네', is_bot: true }];
    const out = buildConversationContextBlock([], ch);
    expect(out).toContain('# 이 채널의 최근 대화');
    expect(out).toContain('- Semi (봇): 네');
  });

  it('채널 항목 중 스레드와 (이름+본문) 중복되는 건 제거', () => {
    const dup: H = { display_name: 'Mark', text: '보고해줘', is_bot: false };
    const out = buildConversationContextBlock(
      [dup],
      [dup, { display_name: 'Mark', text: '다른말', is_bot: false }],
    );
    // 스레드 1회 + 채널 '다른말' 1회 = '보고해줘' 는 채널 섹션에 중복 출력되지 않음
    expect(out.match(/보고해줘/g)?.length).toBe(1);
    expect(out).toContain('- Mark: 다른말');
  });
});
