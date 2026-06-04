/**
 * OutboxReader 재기동 내구성(영속 offset) 회귀 테스트.
 *
 * 버그: watchBot 가 재기동마다 offset=filesize 로 기존 내용을 전부 skip → slack-router
 * 재기동 다운타임 중 serve-worker 가 append 한 reply 가 영영 포스팅되지 않음(유실).
 * 수정: offset 을 .outbox-offset 사이드카에 영속 → 재기동 시 그 지점부터 재개.
 * at-most-once(offset 은 dispatch 시작 지점까지만 전진) 유지 → double-post 없음.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OutboxReader, type GatewayAdapter } from './outbox-reader.js';
import type { InboxWriter } from './inbox-writer.js';

interface PostedRec {
  botId: string;
  channel: string;
  text: string;
}

function makeReader(
  mailboxDir: string,
  posted: PostedRec[],
  platform: 'slack' | 'discord' = 'slack',
): OutboxReader {
  const gateway: GatewayAdapter = {
    postAsBot: async (botId, channel, text) => {
      posted.push({ botId, channel, text });
    },
    setTypingStatus: async () => {},
    addReaction: async () => {},
  };
  return new OutboxReader({
    mailboxDir,
    botIds: ['reviewclaw'],
    platform,
    gateway,
    inboxWriter: {} as unknown as InboxWriter, // reply(채널 지정) 경로에선 미사용
    onEscalation: async () => {},
    onAskUser: async () => {},
  });
}

function replyLine(id: string, text: string): string {
  return (
    JSON.stringify({
      id,
      type: 'reply',
      bot_id: 'reviewclaw',
      text,
      channel_id: 'C_TEST',
      platform: 'slack',
    }) + '\n'
  );
}

describe('OutboxReader persisted offset (재기동 내구성)', () => {
  let dir: string;
  let outbox: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-test-'));
    fs.mkdirSync(path.join(dir, 'reviewclaw'), { recursive: true });
    outbox = path.join(dir, 'reviewclaw', 'outbox.jsonl');
    fs.writeFileSync(outbox, '');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('재기동 다운타임 중 append 된 reply 를 유실 없이 포스팅하고, 이미 포스팅한 건 재포스팅하지 않는다', async () => {
    // ── reader1: 기동 시점에 이미 있던 'a' 는 skip, 가동 중 들어온 'b' 만 포스팅 ──
    const posted1: PostedRec[] = [];
    const r1 = makeReader(dir, posted1);
    fs.appendFileSync(outbox, replyLine('a', 'first')); // 기동 전 존재 → skip 대상
    (r1 as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    fs.appendFileSync(outbox, replyLine('b', 'second')); // 가동 중 도착
    await (r1 as unknown as { processOutbox(b: string): Promise<void> }).processOutbox(
      'reviewclaw',
    );
    r1.stop();
    expect(posted1.map((p) => p.text)).toEqual(['second']); // 'a' skip, 'b' 포스팅

    // ── 다운타임: router 정지 중 serve-worker 가 'c' append ──
    fs.appendFileSync(outbox, replyLine('c', 'third'));

    // ── reader2: 재기동 → 영속 offset('b' 직후)부터 재개 → 'c' 포스팅(유실 X), 'a'/'b' 재포스팅 X ──
    const posted2: PostedRec[] = [];
    const r2 = makeReader(dir, posted2);
    (r2 as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    await (r2 as unknown as { processOutbox(b: string): Promise<void> }).processOutbox(
      'reviewclaw',
    );
    r2.stop();
    expect(posted2.map((p) => p.text)).toEqual(['third']); // 'c' 유실 없이 포스팅, 중복 없음
  });

  it('최초 기동(영속 offset 없음)에는 기존 내용을 skip 한다(기존 동작 보존)', async () => {
    const posted: PostedRec[] = [];
    fs.appendFileSync(outbox, replyLine('x', 'old')); // 기동 전 존재
    const r = makeReader(dir, posted);
    (r as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    await (r as unknown as { processOutbox(b: string): Promise<void> }).processOutbox('reviewclaw');
    r.stop();
    expect(posted).toEqual([]); // 최초 기동 시 기존 내용 미포스팅(double-post 방지 보존)
  });

  it('.outbox-offset 사이드카가 처리 후 디스크에 기록된다', async () => {
    const posted: PostedRec[] = [];
    const r = makeReader(dir, posted);
    (r as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    fs.appendFileSync(outbox, replyLine('y', 'persisted'));
    await (r as unknown as { processOutbox(b: string): Promise<void> }).processOutbox('reviewclaw');
    r.stop();
    const offPath = path.join(dir, 'reviewclaw', '.outbox-offset-slack');
    expect(fs.existsSync(offPath)).toBe(true);
    expect(Number(fs.readFileSync(offPath, 'utf8'))).toBe(fs.statSync(outbox).size);
  });

  it('slack/discord reader 가 platform 별 독립 offset 파일을 써 서로 오염시키지 않는다', async () => {
    // 같은 mailboxDir 의 같은 outbox 를 slack/discord reader 가 동시 watch 하는 실제 배치.
    // slack reply 1건: slack reader 는 포스팅+offset 전진, discord reader 는 skip 하되
    // 자기 offset 만 전진 → 두 offset 파일이 독립이어야 cross-platform 유실이 없다.
    const postedS: PostedRec[] = [];
    const postedD: PostedRec[] = [];
    const rS = makeReader(dir, postedS, 'slack');
    const rD = makeReader(dir, postedD, 'discord');
    (rS as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    (rD as unknown as { watchBot(b: string): void }).watchBot('reviewclaw');
    fs.appendFileSync(outbox, replyLine('s1', 'slack-only')); // platform: 'slack'
    await (rD as unknown as { processOutbox(b: string): Promise<void> }).processOutbox(
      'reviewclaw',
    );
    await (rS as unknown as { processOutbox(b: string): Promise<void> }).processOutbox(
      'reviewclaw',
    );
    rS.stop();
    rD.stop();

    expect(postedD).toEqual([]); // discord 는 slack 메시지 skip
    expect(postedS.map((p) => p.text)).toEqual(['slack-only']); // slack 은 포스팅
    expect(fs.existsSync(path.join(dir, 'reviewclaw', '.outbox-offset-slack'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'reviewclaw', '.outbox-offset-discord'))).toBe(true);
  });
});
