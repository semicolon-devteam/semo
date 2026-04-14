import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Slack SDK ──

const mockWebClient = {
  auth: { test: vi.fn().mockResolvedValue({ user_id: 'U_BOT' }) },
  conversations: { replies: vi.fn() },
  chat: { postMessage: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) },
  reactions: { add: vi.fn().mockResolvedValue({}) },
  users: { info: vi.fn().mockResolvedValue({ user: { profile: { display_name: 'Reus' } } }) },
  assistant: { threads: { setStatus: vi.fn().mockResolvedValue({}) } },
};

const eventHandlers = new Map<string, (...args: any[]) => Promise<void>>();
const mockSocketClient = {
  on: vi.fn((event: string, handler: (...args: any[]) => Promise<void>) => {
    eventHandlers.set(event, handler);
  }),
  start: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(function () {
    return mockWebClient;
  }),
}));

vi.mock('@slack/socket-mode', () => ({
  SocketModeClient: vi.fn(function () {
    return mockSocketClient;
  }),
}));

vi.mock('../bot-config', () => ({
  SLACK_PROFILES: {
    semiclaw: { username: 'SemiClaw', icon_emoji: ':clipboard:' },
    workclaw: { username: 'WorkClaw', icon_emoji: ':hammer_and_wrench:' },
  } as Record<string, { username: string; icon_emoji: string }>,
}));

import { SlackGateway } from '../slack-gateway';

// ── Helpers ──

function ack() {
  return vi.fn().mockResolvedValue(undefined);
}

/** 메시지 이벤트를 시뮬레이션 (socket 'message' 핸들러 호출) */
async function fireMessageEvent(event: Record<string, any>) {
  const handler = eventHandlers.get('message');
  if (!handler) throw new Error('message handler not registered — call gateway.start() first');
  await handler({ event, ack: ack() });
}

/** 멘션 이벤트를 시뮬레이션 */
async function fireMentionEvent(event: Record<string, any>) {
  const handler = eventHandlers.get('app_mention');
  if (!handler) throw new Error('app_mention handler not registered');
  await handler({ event, ack: ack() });
}

// ── Tests ──

describe('SlackGateway', () => {
  let gw: SlackGateway;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    eventHandlers.clear();

    gw = new SlackGateway('xoxb-fake', 'xapp-fake');
    handler = vi.fn().mockResolvedValue(undefined);
    gw.setMessageHandler(handler as unknown as Parameters<typeof gw.setMessageHandler>[0]);
    await gw.start();
  });

  afterEach(async () => {
    await gw.stop();
  });

  // ─────────────────────────────────────────
  // 1. isSystemMessage 판별
  // ─────────────────────────────────────────
  describe('isSystemMessage — 시스템 메시지 패턴 판별', () => {
    it.each([
      ['[Route: workclaw] 작업 시작', 'Route 태그'],
      ['[GFP: phase-4] 섹션 승인', 'GFP 콜백'],
      ['[Dashboard: section-submitted] 제출됨', 'Dashboard 알림'],
      ['[System: restart] 봇 재시작', 'System 메시지'],
      ['[Dispatch: escalation] 에스컬레이션', 'Dispatch 메시지'],
    ])('bot_id 있어도 처리됨 — %s (%s)', async (text, _label) => {
      await fireMessageEvent({
        text,
        user: 'U_OTHER_BOT',
        channel: 'C1',
        ts: '1.1',
        bot_id: 'B_OTHER',
        channel_type: 'im',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      // 시스템 태그 부분이 cleanText에 유지됨 (mention strip만 적용)
      expect(handler.mock.calls[0][0].text).toContain('[');
    });

    it.each([
      ['일반 메시지입니다', '단순 텍스트'],
      ['Route 얘기했어', 'Route 단어만 (대괄호 없음)'],
      ['[Routex: fake]', '유사하지만 다른 패턴'],
      ['', '빈 문자열'],
    ])('시스템 패턴 아님 → bot_id 있으면 무시 — "%s" (%s)', async (text, _label) => {
      await fireMessageEvent({
        text,
        user: 'U_OTHER_BOT',
        channel: 'C1',
        ts: '2.1',
        bot_id: 'B_OTHER',
        channel_type: 'im',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 2. bot_id 필터링
  // ─────────────────────────────────────────
  describe('bot_id 필터링', () => {
    it('bot_id 없는 일반 유저 DM → 정상 처리', async () => {
      await fireMessageEvent({
        text: '안녕',
        user: 'U_HUMAN',
        channel: 'D1',
        ts: '3.1',
        channel_type: 'im',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].user).toBe('U_HUMAN');
    });

    it('bot_id 있고 시스템 패턴 아닌 DM → 무시', async () => {
      await fireMessageEvent({
        text: '봇끼리 대화',
        user: 'U_OTHER_BOT',
        channel: 'D1',
        ts: '3.2',
        bot_id: 'B_ANOTHER',
        channel_type: 'im',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('자기 자신(botUserId) 메시지 → 무시', async () => {
      await fireMessageEvent({
        text: '내가 보낸 메시지',
        user: 'U_BOT', // botUserId
        channel: 'C1',
        ts: '3.3',
        channel_type: 'im',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 3. 메시지 진입 조건 (DM / thread reply / system)
  // ─────────────────────────────────────────
  describe('메시지 이벤트 진입 조건', () => {
    it('채널 top-level (DM 아닌, 스레드 아닌, 시스템 아닌) → 무시', async () => {
      await fireMessageEvent({
        text: '일반 채널 메시지',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '4.1',
        channel_type: 'channel',
        // thread_ts 없음 → top-level
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('스레드 답글 → 봇이 참여한 스레드만 처리', async () => {
      // 먼저 봇이 멘션되어 스레드 등록
      await fireMentionEvent({
        text: '<@U_BOT> 도와줘',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '4.0',
      });
      handler.mockClear();

      // 같은 스레드의 답글 → 처리
      await fireMessageEvent({
        text: '스레드 답글',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '4.3',
        thread_ts: '4.0',
        channel_type: 'channel',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('thread_ts === ts (부모 자체) → 스레드 답글 아님 → 무시', async () => {
      await fireMessageEvent({
        text: '부모 메시지',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '4.4',
        thread_ts: '4.4', // 자기 자신
        channel_type: 'channel',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 4. cleanText — 멘션 제거
  // ─────────────────────────────────────────
  describe('cleanText — 멘션 제거', () => {
    it('봇 멘션을 제거하고 나머지 텍스트만 전달', async () => {
      await fireMentionEvent({
        text: '<@U_BOT> 안녕하세요 도와주세요',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '5.1',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].text).toBe('안녕하세요 도와주세요');
    });

    it('멘션 여러 번 → 전부 제거', async () => {
      await fireMentionEvent({
        text: '<@U_BOT> 첫번째 <@U_BOT> 두번째',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '5.2',
      });

      expect(handler.mock.calls[0][0].text).toBe('첫번째 두번째');
    });

    it('멘션만 있고 실제 텍스트 없음 → 핸들러 호출 안됨', async () => {
      await fireMentionEvent({
        text: '<@U_BOT>  ',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '5.3',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 5. getThreadHistory — 포매팅 + 잘림
  // ─────────────────────────────────────────
  describe('getThreadHistory', () => {
    it('conversations.replies 결과를 ThreadMessage[]로 포매팅', async () => {
      mockWebClient.conversations.replies.mockResolvedValueOnce({
        messages: [
          { user: 'U1', text: '첫 메시지', username: 'reus' },
          { user: 'U2', text: '두번째', bot_id: 'B1', username: 'SemiClaw' },
          { user: 'U1', text: '현재 메시지 (제외됨)' }, // 마지막 → slice로 제외
        ],
      });

      const history = await gw.getThreadHistory('C1', '1.0', 15);

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        displayName: 'reus',
        text: '첫 메시지',
        isBotMessage: false,
      });
      expect(history[1]).toEqual({
        displayName: 'SemiClaw',
        text: '두번째',
        isBotMessage: true,
      });
    });

    it('500자 초과 메시지 → "...(잘림)" 접미사', async () => {
      const longText = 'A'.repeat(600);
      mockWebClient.conversations.replies.mockResolvedValueOnce({
        messages: [
          { user: 'U1', text: longText },
          { user: 'U1', text: '현재' }, // 마지막 → 제외
        ],
      });

      const history = await gw.getThreadHistory('C1', '1.0');

      expect(history).toHaveLength(1);
      expect(history[0].text).toHaveLength(500 + '...(잘림)'.length);
      expect(history[0].text.endsWith('...(잘림)')).toBe(true);
    });

    it('500자 이하 → 잘림 없음', async () => {
      const exactText = 'B'.repeat(500);
      mockWebClient.conversations.replies.mockResolvedValueOnce({
        messages: [
          { user: 'U1', text: exactText },
          { user: 'U1', text: '현재' },
        ],
      });

      const history = await gw.getThreadHistory('C1', '1.0');

      expect(history[0].text).toBe(exactText);
      expect(history[0].text).not.toContain('잘림');
    });

    it('API 에러 → 빈 배열 반환 (throw 아님)', async () => {
      mockWebClient.conversations.replies.mockRejectedValueOnce(new Error('channel_not_found'));

      const history = await gw.getThreadHistory('C_INVALID', '1.0');

      expect(history).toEqual([]);
    });

    it('빈 replies → 빈 배열', async () => {
      mockWebClient.conversations.replies.mockResolvedValueOnce({ messages: [] });

      const history = await gw.getThreadHistory('C1', '1.0');

      expect(history).toEqual([]);
    });

    it('limit 파라미터가 API에 limit+1로 전달됨', async () => {
      mockWebClient.conversations.replies.mockResolvedValueOnce({ messages: [] });

      await gw.getThreadHistory('C1', '1.0', 10);

      expect(mockWebClient.conversations.replies).toHaveBeenCalledWith({
        channel: 'C1',
        ts: '1.0',
        limit: 11, // 10 + 1 (마지막 메시지 제외용)
      });
    });

    it('username 없으면 user ID가 displayName', async () => {
      mockWebClient.conversations.replies.mockResolvedValueOnce({
        messages: [
          { user: 'U_ANON', text: '익명' },
          { user: 'U1', text: '현재' },
        ],
      });

      const history = await gw.getThreadHistory('C1', '1.0');

      expect(history[0].displayName).toBe('U_ANON');
    });
  });

  // ─────────────────────────────────────────
  // 6. Busy 큐 — 동일 스레드 직렬 처리
  // ─────────────────────────────────────────
  describe('busy 큐', () => {
    it('동일 스레드 두 번째 메시지 → 큐잉 후 첫 번째 완료 후 처리', async () => {
      const callOrder: string[] = [];

      // 첫 번째 메시지: 지연 처리
      let resolveFirst!: () => void;
      const firstPromise = new Promise<void>((r) => (resolveFirst = r));
      handler.mockImplementationOnce(async (msg: any) => {
        callOrder.push(`start:${msg.text}`);
        await firstPromise;
        callOrder.push(`end:${msg.text}`);
      });
      // 두 번째 메시지: 즉시 처리
      handler.mockImplementationOnce(async (msg: any) => {
        callOrder.push(`start:${msg.text}`);
        callOrder.push(`end:${msg.text}`);
      });

      const p1 = fireMessageEvent({
        text: 'first',
        user: 'U_HUMAN',
        channel: 'D1',
        ts: '6.1',
        thread_ts: '6.0',
        channel_type: 'im',
      });

      // first가 busy인 상태에서 second 전송
      await fireMessageEvent({
        text: 'second',
        user: 'U_HUMAN',
        channel: 'D1',
        ts: '6.2',
        thread_ts: '6.0', // 같은 스레드
        channel_type: 'im',
      });

      // 큐잉 시 typing status 메시지 확인
      const statusCalls = mockWebClient.assistant.threads.setStatus.mock.calls;
      const busyMsg = statusCalls.find((c: any[]) => (c[0]?.status || '').includes('다른 질문'));
      expect(busyMsg).toBeTruthy();

      // first 완료 → second 자동 처리
      resolveFirst();
      await p1;
      // setImmediate 처리 대기
      await new Promise((r) => setTimeout(r, 50));

      expect(callOrder[0]).toBe('start:first');
      expect(callOrder[1]).toBe('end:first');
    });

    it('다른 스레드는 동시 처리 (큐잉 안됨)', async () => {
      let resolveFirst!: () => void;
      const firstPromise = new Promise<void>((r) => (resolveFirst = r));
      handler.mockImplementationOnce(async () => {
        await firstPromise;
      });

      const p1 = fireMessageEvent({
        text: 'thread-A',
        user: 'U_HUMAN',
        channel: 'D1',
        ts: '7.1',
        thread_ts: '7.0',
        channel_type: 'im',
      });

      // 다른 스레드
      await fireMessageEvent({
        text: 'thread-B',
        user: 'U_HUMAN',
        channel: 'D1',
        ts: '8.1',
        thread_ts: '8.0',
        channel_type: 'im',
      });

      // thread-B는 큐잉 없이 바로 handler 호출됨
      expect(handler).toHaveBeenCalledTimes(2);

      resolveFirst();
      await p1;
    });
  });

  // ─────────────────────────────────────────
  // 7. postAsBot — 프로필 선택
  // ─────────────────────────────────────────
  describe('postAsBot', () => {
    it('등록된 botId → SLACK_PROFILES에서 username/icon_emoji 사용', async () => {
      await gw.postAsBot('semiclaw', 'C1', '안녕', '1.0');

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C1',
          text: '안녕',
          thread_ts: '1.0',
          username: 'SemiClaw',
          icon_emoji: ':clipboard:',
          unfurl_links: false,
        }),
      );
    });

    it('미등록 botId → profile 필드 없이 전송', async () => {
      await gw.postAsBot('unknownbot', 'C1', '메시지', undefined);

      const call = mockWebClient.chat.postMessage.mock.calls[0][0];
      expect(call.username).toBeUndefined();
      expect(call.icon_emoji).toBeUndefined();
      expect(call.thread_ts).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────
  // 8. :eyes: 리액션
  // ─────────────────────────────────────────
  describe(':eyes: 리액션', () => {
    it('메시지 수신 시 eyes 리액션 추가', async () => {
      await fireMentionEvent({
        text: '<@U_BOT> 테스트',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '9.1',
      });

      expect(mockWebClient.reactions.add).toHaveBeenCalledWith({
        name: 'eyes',
        channel: 'C1',
        timestamp: '9.1',
      });
    });

    it('리액션 실패해도 메시지 처리는 계속됨', async () => {
      mockWebClient.reactions.add.mockRejectedValueOnce(new Error('already_reacted'));

      await fireMentionEvent({
        text: '<@U_BOT> 계속 처리됨',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '9.2',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────
  // 9. 유저 이름 조회 fallback
  // ─────────────────────────────────────────
  describe('senderName 조회', () => {
    it('users.info 성공 → display_name 사용', async () => {
      mockWebClient.users.info.mockResolvedValueOnce({
        user: { profile: { display_name: 'Reus' } },
      });

      await fireMentionEvent({
        text: '<@U_BOT> 확인',
        user: 'U_HUMAN',
        channel: 'C1',
        ts: '10.1',
      });

      expect(handler.mock.calls[0][1]).toBe('Reus');
    });

    it('users.info 실패 → user ID를 senderName으로 사용', async () => {
      mockWebClient.users.info.mockRejectedValueOnce(new Error('user_not_found'));

      await fireMentionEvent({
        text: '<@U_BOT> 확인',
        user: 'U_FALLBACK',
        channel: 'C1',
        ts: '10.2',
      });

      expect(handler.mock.calls[0][1]).toBe('U_FALLBACK');
    });
  });

  // ─────────────────────────────────────────
  // 10. SlackMessage 구조
  // ─────────────────────────────────────────
  describe('SlackMessage 구성', () => {
    it('thread_ts, bot_id가 원본 이벤트에서 그대로 전달', async () => {
      await fireMessageEvent({
        text: '[System: test] 시스템 메시지',
        user: 'U_SYS',
        channel: 'C1',
        ts: '11.1',
        thread_ts: '11.0',
        bot_id: 'B_SYS',
        channel_type: 'im',
      });

      const msg = handler.mock.calls[0][0];
      expect(msg.channel).toBe('C1');
      expect(msg.ts).toBe('11.1');
      expect(msg.thread_ts).toBe('11.0');
      expect(msg.bot_id).toBe('B_SYS');
    });
  });
});
