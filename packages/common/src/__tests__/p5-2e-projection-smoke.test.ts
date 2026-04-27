/**
 * P5-2e 시뮬레이션 — OutboxReader 가 projection 주입 시:
 *   1. projection 미주입: gateway 단독 호출
 *   2. projection ok=true: emitter 만 호출 (gateway 미호출)
 *   3. projection ok=false: emitter + gateway fallback
 *   4. projection throw: emitter try-catch + gateway fallback
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { OutboxReader, InboxWriter } from '../index.js';
import type {
  GatewayAdapter,
  ProjectionEmitter,
  ProjectionTarget,
  ProjectionPayload,
  ProjectionResult,
} from '../index.js';

const BOT_ID = 'smokebot';

function writeOutbox(mailboxDir: string) {
  const dir = path.join(mailboxDir, BOT_ID);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    id: 'msg1',
    type: 'reply',
    bot_id: BOT_ID,
    channel_id: 'C123',
    thread_id: '1234.5678',
    text: 'hello from p5-2e smoke',
    platform: 'slack',
  });
  fs.writeFileSync(path.join(dir, 'outbox.jsonl'), line + '\n');
}

interface RecordedCall {
  via: string;
}

function makeGateway(calls: RecordedCall[]): GatewayAdapter {
  return {
    postAsBot: async () => {
      calls.push({ via: 'gateway' });
    },
    setTypingStatus: async () => {},
    addReaction: async () => {},
  };
}

function makeEmitter(kind: 'ok' | 'fail' | 'throw', calls: RecordedCall[]): ProjectionEmitter {
  return {
    emit: async (
      target: ProjectionTarget,
      _payload: ProjectionPayload,
    ): Promise<ProjectionResult> => {
      calls.push({ via: `emitter-${kind}` });
      if (kind === 'throw') throw new Error('simulated throw');
      return {
        channel: target.channel,
        ok: kind === 'ok',
        error: kind === 'fail' ? 'simulated fail' : undefined,
      };
    },
    emitAll: async () => [],
  };
}

async function runReader(
  mailboxDir: string,
  projection: ProjectionEmitter | undefined,
  calls: RecordedCall[],
): Promise<void> {
  // 빈 outbox 로 시작 → start() 가 offset=0 으로 잡음 → 그 다음 append 가 처리됨.
  fs.mkdirSync(path.join(mailboxDir, BOT_ID), { recursive: true });
  fs.writeFileSync(path.join(mailboxDir, BOT_ID, 'outbox.jsonl'), '');

  const reader = new OutboxReader({
    mailboxDir,
    botIds: [BOT_ID],
    platform: 'slack',
    gateway: makeGateway(calls),
    projection,
    inboxWriter: new InboxWriter(mailboxDir),
    onEscalation: async () => {},
    onAskUser: async () => {},
  });
  reader.start();
  await new Promise((r) => setTimeout(r, 100)); // start() settle

  writeOutbox(mailboxDir);

  await new Promise((r) => setTimeout(r, 1200)); // poll cycle
  reader.stop();
}

describe('P5-2e: OutboxReader projection 주입 합류', () => {
  let mailboxDir: string;

  beforeEach(() => {
    mailboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-2e-')) + '/mailbox';
    fs.mkdirSync(mailboxDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(path.dirname(mailboxDir), { recursive: true, force: true });
  });

  it('1. projection 미주입 → gateway 단독', async () => {
    const calls: RecordedCall[] = [];
    await runReader(mailboxDir, undefined, calls);
    expect(calls.map((c) => c.via)).toEqual(['gateway']);
  });

  it('2. projection ok=true → emitter 만, gateway 미호출', async () => {
    const calls: RecordedCall[] = [];
    await runReader(mailboxDir, makeEmitter('ok', calls), calls);
    expect(calls.map((c) => c.via)).toEqual(['emitter-ok']);
  });

  it('3. projection ok=false → emitter + gateway fallback', async () => {
    const calls: RecordedCall[] = [];
    await runReader(mailboxDir, makeEmitter('fail', calls), calls);
    expect(calls.map((c) => c.via)).toEqual(['emitter-fail', 'gateway']);
  });

  it('4. projection throw → emitter try-catch + gateway fallback', async () => {
    const calls: RecordedCall[] = [];
    await runReader(mailboxDir, makeEmitter('throw', calls), calls);
    expect(calls.map((c) => c.via)).toEqual(['emitter-throw', 'gateway']);
  });
});
