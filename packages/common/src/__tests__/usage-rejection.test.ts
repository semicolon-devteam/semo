/**
 * Usage-rejection guard tests.
 *
 * Background (2026-05-04 incident): Claude Code Max 구독의 extra usage 가
 * 소진되면 봇이 받는 LLM 응답이 통째로 거부 텍스트("LLM request rejected:
 * You're out of extra usage…")로 대체되고, 그 텍스트가 outbox 의 reply 로
 * 그대로 흘러 #bot-ops + reus DM 에 반복 게시됐다.
 *
 * 가드는 OutboxReader 가 reply 텍스트를 검사해 매칭 시:
 *   1) Slack/Discord 게시 차단
 *   2) onUsageRejection 콜백을 per-bot 1회/시간 throttle 로 호출
 *   3) onReplyPosted 호출 안 함 (commitment 는 stale_auto reaper 가 처리)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isUsageRejection, USAGE_REJECTION_PATTERNS } from '../mailbox/usage-rejection.js';
import { OutboxReader, InboxWriter } from '../index.js';
import type { GatewayAdapter } from '../index.js';

const BOT_ID = 'rejectbot';

describe('isUsageRejection — 패턴 매칭', () => {
  it('정확한 incident 텍스트 매칭', () => {
    expect(
      isUsageRejection(
        "LLM request rejected: You're out of extra usage. Add more at claude.ai/settings/usage and keep going.",
      ),
    ).toBe(true);
  });

  it('각 패턴이 단독으로도 매칭', () => {
    expect(isUsageRejection('LLM request rejected: foo')).toBe(true);
    expect(isUsageRejection('You are out of extra usage')).toBe(true);
    expect(isUsageRejection('See https://claude.ai/settings/usage for details')).toBe(true);
    expect(isUsageRejection('Add more at claude.ai or wait')).toBe(true);
  });

  it('대소문자 무관 매칭', () => {
    expect(isUsageRejection('llm REQUEST rejected — retry later')).toBe(true);
    expect(isUsageRejection('OUT OF EXTRA USAGE')).toBe(true);
  });

  it('정상 응답은 통과', () => {
    expect(isUsageRejection('PRD v1.0 작성 완료. KB 업로드했습니다.')).toBe(false);
    expect(isUsageRejection('hello from planclaw')).toBe(false);
    expect(isUsageRejection('')).toBe(false);
    expect(isUsageRejection(undefined)).toBe(false);
    expect(isUsageRejection(null)).toBe(false);
  });

  it('정상 텍스트에 "usage" 단어 단독 등장은 통과 (false-positive 방지)', () => {
    expect(isUsageRejection('CPU usage spiked to 90%')).toBe(false);
    expect(isUsageRejection('memory usage report attached')).toBe(false);
  });

  it('패턴 export 가 외부에서 검사 가능', () => {
    expect(USAGE_REJECTION_PATTERNS.length).toBeGreaterThan(0);
    for (const p of USAGE_REJECTION_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });
});

interface PostCall {
  bot: string;
  text: string;
}

interface AlertCall {
  bot: string;
  text: string;
  at: number;
}

function makeGateway(posts: PostCall[]): GatewayAdapter {
  return {
    postAsBot: async (botId, _channel, text) => {
      posts.push({ bot: botId, text });
    },
    setTypingStatus: async () => {},
    addReaction: async () => {},
  };
}

function appendOutbox(mailboxDir: string, line: object) {
  const dir = path.join(mailboxDir, BOT_ID);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'outbox.jsonl'), JSON.stringify(line) + '\n');
}

describe('OutboxReader usage-rejection guard', () => {
  let mailboxDir: string;

  beforeEach(() => {
    mailboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-reject-')) + '/mailbox';
    fs.mkdirSync(mailboxDir, { recursive: true });
    fs.mkdirSync(path.join(mailboxDir, BOT_ID), { recursive: true });
    fs.writeFileSync(path.join(mailboxDir, BOT_ID, 'outbox.jsonl'), '');
  });

  afterEach(() => {
    fs.rmSync(path.dirname(mailboxDir), { recursive: true, force: true });
  });

  it('rejection reply 는 게시 차단 + onUsageRejection 1회 호출 + onReplyPosted 호출 안 함', async () => {
    const posts: PostCall[] = [];
    const alerts: AlertCall[] = [];
    let replyPostedCalls = 0;

    const reader = new OutboxReader({
      mailboxDir,
      botIds: [BOT_ID],
      platform: 'slack',
      gateway: makeGateway(posts),
      inboxWriter: new InboxWriter(mailboxDir),
      onEscalation: async () => {},
      onAskUser: async () => {},
      onReplyPosted: async () => {
        replyPostedCalls++;
      },
      onUsageRejection: async (botId, text) => {
        alerts.push({ bot: botId, text, at: Date.now() });
      },
    });
    reader.start();
    await new Promise((r) => setTimeout(r, 100));

    appendOutbox(mailboxDir, {
      id: 'r1',
      type: 'reply',
      bot_id: BOT_ID,
      channel_id: 'C-DM',
      thread_id: 't1',
      platform: 'slack',
      text: "LLM request rejected: You're out of extra usage. Add more at claude.ai/settings/usage and keep going.",
    });

    await new Promise((r) => setTimeout(r, 1200));
    reader.stop();

    expect(posts).toHaveLength(0);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].bot).toBe(BOT_ID);
    expect(replyPostedCalls).toBe(0);
  });

  it('정상 reply 는 그대로 게시', async () => {
    const posts: PostCall[] = [];
    const alerts: AlertCall[] = [];

    const reader = new OutboxReader({
      mailboxDir,
      botIds: [BOT_ID],
      platform: 'slack',
      gateway: makeGateway(posts),
      inboxWriter: new InboxWriter(mailboxDir),
      onEscalation: async () => {},
      onAskUser: async () => {},
      onUsageRejection: async (botId, text) => {
        alerts.push({ bot: botId, text, at: Date.now() });
      },
    });
    reader.start();
    await new Promise((r) => setTimeout(r, 100));

    appendOutbox(mailboxDir, {
      id: 'r2',
      type: 'reply',
      bot_id: BOT_ID,
      channel_id: 'C-DM',
      thread_id: 't1',
      platform: 'slack',
      text: '정상 응답입니다.',
    });

    await new Promise((r) => setTimeout(r, 1200));
    reader.stop();

    expect(posts).toHaveLength(1);
    expect(posts[0].text).toBe('정상 응답입니다.');
    expect(alerts).toHaveLength(0);
  });

  it('연속 rejection reply 가 와도 onUsageRejection 은 throttle 됨 (per-bot 1회)', async () => {
    const posts: PostCall[] = [];
    const alerts: AlertCall[] = [];

    const reader = new OutboxReader({
      mailboxDir,
      botIds: [BOT_ID],
      platform: 'slack',
      gateway: makeGateway(posts),
      inboxWriter: new InboxWriter(mailboxDir),
      onEscalation: async () => {},
      onAskUser: async () => {},
      onUsageRejection: async (botId, text) => {
        alerts.push({ bot: botId, text, at: Date.now() });
      },
    });
    reader.start();
    await new Promise((r) => setTimeout(r, 100));

    for (let i = 0; i < 5; i++) {
      appendOutbox(mailboxDir, {
        id: `r${i}`,
        type: 'reply',
        bot_id: BOT_ID,
        channel_id: 'C-DM',
        thread_id: 't1',
        platform: 'slack',
        text: "LLM request rejected: You're out of extra usage.",
      });
    }

    await new Promise((r) => setTimeout(r, 1500));
    reader.stop();

    expect(posts).toHaveLength(0);
    // 5건 모두 차단되었지만 알림은 1회만.
    expect(alerts).toHaveLength(1);
  });
});
