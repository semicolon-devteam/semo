/**
 * P2.1 — Discord Personal 컨포먼스 (mailbox 체인)
 *
 * discord-router 의 Personal 경로:
 *   Discord 메시지 수신
 *     ↓
 *   StaticRouter.route()        (DB 없음, route-tag/thread/fallback)
 *     ↓
 *   InboxWriter.write()         (file JSONL, O_EXCL lock, nudge 무시)
 *     ↓
 *   [봇 세션이 outbox.jsonl 에 reply 기록]
 *     ↓
 *   OutboxReader poll/watch
 *     ↓
 *   GatewayAdapter.postAsBot() → Discord
 *   onReplyPosted hook (Personal 은 noop — slack-router 와 달리 commitment 마감 없음)
 *
 * 이 스위트는 router 자체(discord.js WebSocket)를 띄우지 않고,
 * StaticRouter + file mailbox + 모의 GatewayAdapter 조합만 end-to-end 로 돈다.
 *
 * 깨지면 의미:
 *   Personal 사용자가 Discord bot 을 띄워도 메시지가 봇 세션에 안 닿거나,
 *   봇이 답한 내용이 Discord 에 돌아가지 않는 상태가 된다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StaticRouter,
  InboxWriter,
  OutboxReader,
  type GatewayAdapter,
  type InboxMessage,
  type OutboxMessage,
} from '@team-semicolon/semo-common';

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length > 0) {
    const d = tmpRoots.pop()!;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function mkMailboxDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'semo-discord-'));
  tmpRoots.push(d);
  return d;
}

function makeInbox(overrides: Partial<InboxMessage> = {}): Omit<InboxMessage, 'id' | 'timestamp'> {
  return {
    type: 'message',
    priority: 'normal',
    platform: 'discord',
    channel_id: 'dm-123',
    thread_id: '',
    message_id: 'msg-1',
    sender_name: 'alice',
    sender_id: 'user-1',
    text: '안녕',
    route_reason: 'fallback',
    ...overrides,
  };
}

/**
 * 테스트용 GatewayAdapter 스파이 — 호출을 기록만 하고 성공 반환.
 */
function spyGateway() {
  const calls = {
    postAsBot: [] as Array<{ botId: string; channel: string; text: string; threadTs?: string }>,
    setTypingStatus: [] as Array<{ channel: string; threadTs: string; status: string }>,
    addReaction: [] as Array<{ channel: string; ts: string; emoji: string }>,
  };
  const gateway: GatewayAdapter = {
    async postAsBot(botId, channel, text, threadTs) {
      calls.postAsBot.push({ botId, channel, text, threadTs });
    },
    async setTypingStatus(channel, threadTs, status) {
      calls.setTypingStatus.push({ channel, threadTs, status });
    },
    async addReaction(channel, ts, emoji) {
      calls.addReaction.push({ channel, ts, emoji });
    },
  };
  return { gateway, calls };
}

describe('P2.1 Discord Personal — StaticRouter + InboxWriter', () => {
  it('fallback 라우팅 → 기본 봇 inbox.jsonl 에 한 줄 적힘', async () => {
    const dir = mkMailboxDir();
    const router = new StaticRouter({ defaultBotId: 'semiclaw' });
    const writer = new InboxWriter(dir);

    const route = await router.route('dm-1', '오늘 일정 정리해줘');
    expect(route.botId).toBe('semiclaw');
    expect(route.routeReason).toBe('fallback');

    const id = await writer.write(
      route.botId,
      makeInbox({ text: '오늘 일정 정리해줘', route_reason: route.routeReason }),
    );

    const inboxPath = path.join(dir, 'semiclaw', 'inbox.jsonl');
    expect(fs.existsSync(inboxPath)).toBe(true);

    const lines = fs.readFileSync(inboxPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.id).toBe(id);
    expect(entry.text).toBe('오늘 일정 정리해줘');
    expect(entry.platform).toBe('discord');
    expect(entry.route_reason).toBe('fallback');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('[Route: planclaw] 태그 → 해당 봇 inbox 로 분리 기록', async () => {
    const dir = mkMailboxDir();
    const router = new StaticRouter({
      defaultBotId: 'semiclaw',
      validBotIds: ['semiclaw', 'planclaw', 'workclaw'],
    });
    const writer = new InboxWriter(dir);

    const text = '[Route: planclaw] 스펙 초안 잡아줘';
    const route = await router.route('dm-1', text);
    expect(route.botId).toBe('planclaw');

    await writer.write(route.botId, makeInbox({ text, route_reason: route.routeReason }));

    expect(fs.existsSync(path.join(dir, 'planclaw', 'inbox.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'semiclaw', 'inbox.jsonl'))).toBe(false);
  });

  it('여러 메시지가 순서대로 append 되고 lock 파일은 남지 않음', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);

    await writer.write('semiclaw', makeInbox({ text: 'first', message_id: 'm1' }));
    await writer.write('semiclaw', makeInbox({ text: 'second', message_id: 'm2' }));
    await writer.write('semiclaw', makeInbox({ text: 'third', message_id: 'm3' }));

    const inboxPath = path.join(dir, 'semiclaw', 'inbox.jsonl');
    const lines = fs.readFileSync(inboxPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).text).toBe('first');
    expect(JSON.parse(lines[1]).text).toBe('second');
    expect(JSON.parse(lines[2]).text).toBe('third');

    expect(fs.existsSync(inboxPath + '.lock')).toBe(false);
  });

  it('archive 디렉토리가 선제 생성됨 (봇 세션의 archive move 용)', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    await writer.write('semiclaw', makeInbox());
    expect(fs.existsSync(path.join(dir, 'semiclaw', 'archive'))).toBe(true);
  });

  it('surface map 이 없어도 nudge 는 조용히 실패 (CI/테스트 환경 안전)', async () => {
    const dir = mkMailboxDir();
    const prev = process.env.SEMO_SURFACE_MAP;
    process.env.SEMO_SURFACE_MAP = path.join(dir, 'no-such-surface-map.json');
    try {
      const writer = new InboxWriter(dir);
      const map = writer.getSurfaceMap();
      expect(Object.keys(map.surfaces)).toHaveLength(0);
      // nudge 가 throw 하면 이 라인이 reject 된다
      await expect(writer.write('semiclaw', makeInbox())).resolves.toBeTypeOf('string');
    } finally {
      if (prev === undefined) delete process.env.SEMO_SURFACE_MAP;
      else process.env.SEMO_SURFACE_MAP = prev;
    }
  });
});

describe('P2.1 Discord Personal — OutboxReader + 모의 Gateway', () => {
  it('봇이 outbox 에 reply 쓰면 GatewayAdapter.postAsBot 호출 + onReplyPosted 발화', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    const { gateway, calls } = spyGateway();

    // 먼저 inbox 를 seed — reader 시작 전에 파일만 존재하면 됨
    const inId = await writer.write('semiclaw', makeInbox({ message_id: 'orig-1' }));

    const replyPosted: OutboxMessage[] = [];
    const reader = new OutboxReader({
      mailboxDir: dir,
      botIds: ['semiclaw'],
      platform: 'discord',
      gateway,
      inboxWriter: writer,
      onEscalation: async () => {},
      onAskUser: async () => {},
      onReplyPosted: async (msg) => {
        replyPosted.push(msg);
      },
    });

    reader.start();
    try {
      // start() 는 기존 바이트를 skip 하므로, 시작 후에 새 줄을 append.
      const outbox: OutboxMessage = {
        id: 'out-1',
        in_reply_to: inId,
        timestamp: new Date().toISOString(),
        type: 'reply',
        bot_id: 'semiclaw',
        text: '안녕하세요 — 로컬 Ollama 응답.',
        platform: 'discord',
        channel_id: 'dm-123',
        thread_id: '',
      };

      const outboxPath = path.join(dir, 'semiclaw', 'outbox.jsonl');
      fs.appendFileSync(outboxPath, JSON.stringify(outbox) + '\n');

      // poll 간격(500ms) 1사이클 대기.
      await waitUntil(() => calls.postAsBot.length > 0, 2_000);

      expect(calls.postAsBot).toHaveLength(1);
      expect(calls.postAsBot[0].botId).toBe('semiclaw');
      expect(calls.postAsBot[0].channel).toBe('dm-123');
      expect(calls.postAsBot[0].text).toContain('Ollama');

      expect(replyPosted).toHaveLength(1);
      expect(replyPosted[0].in_reply_to).toBe(inId);
    } finally {
      reader.stop();
    }
  });

  it('다른 platform 값은 스킵 (discord reader 가 slack 메시지 먹지 않음)', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    const { gateway, calls } = spyGateway();

    const reader = new OutboxReader({
      mailboxDir: dir,
      botIds: ['semiclaw'],
      platform: 'discord',
      gateway,
      inboxWriter: writer,
      onEscalation: async () => {},
      onAskUser: async () => {},
    });

    reader.start();
    try {
      const slackOnly: OutboxMessage = {
        id: 'out-slack',
        in_reply_to: 'x',
        timestamp: new Date().toISOString(),
        type: 'reply',
        bot_id: 'semiclaw',
        text: 'slack-only',
        platform: 'slack',
        channel_id: 'C123',
        thread_id: '',
      };
      fs.appendFileSync(
        path.join(dir, 'semiclaw', 'outbox.jsonl'),
        JSON.stringify(slackOnly) + '\n',
      );
      await new Promise((r) => setTimeout(r, 1_100));
      expect(calls.postAsBot).toHaveLength(0);
    } finally {
      reader.stop();
    }
  });

  it('channel_id 누락 시 in_reply_to 기반 inbox lookup 으로 복구', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    const { gateway, calls } = spyGateway();

    const inId = await writer.write(
      'semiclaw',
      makeInbox({ channel_id: 'dm-recovery', thread_id: 'thr-9' }),
    );

    const reader = new OutboxReader({
      mailboxDir: dir,
      botIds: ['semiclaw'],
      platform: 'discord',
      gateway,
      inboxWriter: writer,
      onEscalation: async () => {},
      onAskUser: async () => {},
    });

    reader.start();
    try {
      // channel_id / thread_id 를 일부러 비움
      const partial: OutboxMessage = {
        id: 'out-2',
        in_reply_to: inId,
        timestamp: new Date().toISOString(),
        type: 'reply',
        bot_id: 'semiclaw',
        text: '복구 테스트',
        platform: 'discord',
        channel_id: '',
        thread_id: '',
      };
      fs.appendFileSync(path.join(dir, 'semiclaw', 'outbox.jsonl'), JSON.stringify(partial) + '\n');
      await waitUntil(() => calls.postAsBot.length > 0, 2_000);
      expect(calls.postAsBot[0].channel).toBe('dm-recovery');
      expect(calls.postAsBot[0].threadTs).toBe('thr-9');
    } finally {
      reader.stop();
    }
  });

  it('status_update / react 도 각 gateway 메서드로 라우팅', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    const { gateway, calls } = spyGateway();

    const reader = new OutboxReader({
      mailboxDir: dir,
      botIds: ['semiclaw'],
      platform: 'discord',
      gateway,
      inboxWriter: writer,
      onEscalation: async () => {},
      onAskUser: async () => {},
    });

    reader.start();
    try {
      const typing: OutboxMessage = {
        id: 'st-1',
        in_reply_to: 'x',
        timestamp: new Date().toISOString(),
        type: 'status_update',
        bot_id: 'semiclaw',
        platform: 'discord',
        channel_id: 'dm-1',
        thread_id: '',
        status_text: '생각 중...',
      };
      const react: OutboxMessage = {
        id: 'rx-1',
        in_reply_to: 'x',
        timestamp: new Date().toISOString(),
        type: 'react',
        bot_id: 'semiclaw',
        platform: 'discord',
        channel_id: 'dm-1',
        thread_id: '',
        message_id: 'msg-abc',
        emoji: '👀',
      };
      fs.appendFileSync(
        path.join(dir, 'semiclaw', 'outbox.jsonl'),
        JSON.stringify(typing) + '\n' + JSON.stringify(react) + '\n',
      );
      await waitUntil(
        () => calls.setTypingStatus.length > 0 && calls.addReaction.length > 0,
        2_000,
      );
      expect(calls.setTypingStatus[0].status).toBe('생각 중...');
      expect(calls.addReaction[0].emoji).toBe('👀');
      expect(calls.postAsBot).toHaveLength(0);
    } finally {
      reader.stop();
    }
  });

  it('escalation / ask_user 는 전용 핸들러에 전달 (gateway 호출 없음)', async () => {
    const dir = mkMailboxDir();
    const writer = new InboxWriter(dir);
    const { gateway, calls } = spyGateway();

    const escalations: OutboxMessage[] = [];
    const asks: OutboxMessage[] = [];

    const reader = new OutboxReader({
      mailboxDir: dir,
      botIds: ['semiclaw'],
      platform: 'discord',
      gateway,
      inboxWriter: writer,
      onEscalation: async (m) => {
        escalations.push(m);
      },
      onAskUser: async (m) => {
        asks.push(m);
      },
    });

    reader.start();
    try {
      const esc: OutboxMessage = {
        id: 'esc-1',
        in_reply_to: 'x',
        timestamp: new Date().toISOString(),
        type: 'escalation',
        bot_id: 'semiclaw',
        platform: 'discord',
        channel_id: 'dm-1',
        thread_id: '',
        target_bot_id: 'planclaw',
        escalation_reason: 'need spec',
      };
      const ask: OutboxMessage = {
        id: 'ask-1',
        in_reply_to: 'x',
        timestamp: new Date().toISOString(),
        type: 'ask_user',
        bot_id: 'semiclaw',
        platform: 'discord',
        channel_id: 'dm-1',
        thread_id: '',
        question: 'OpenClaw 모델 어떤 걸 쓸래요?',
      };
      fs.appendFileSync(
        path.join(dir, 'semiclaw', 'outbox.jsonl'),
        JSON.stringify(esc) + '\n' + JSON.stringify(ask) + '\n',
      );
      await waitUntil(() => escalations.length > 0 && asks.length > 0, 2_000);
      expect(escalations[0].target_bot_id).toBe('planclaw');
      expect(asks[0].question).toContain('OpenClaw');
      expect(calls.postAsBot).toHaveLength(0);
    } finally {
      reader.stop();
    }
  });
});

/** 조건이 만족될 때까지 폴링 대기. `waitUntil(() => done, 2000)` */
async function waitUntil(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}
