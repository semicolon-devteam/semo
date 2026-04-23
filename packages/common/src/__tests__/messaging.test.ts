import { describe, expect, it } from 'vitest';
import { Readable, Writable } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  StdinSource,
  HttpSource,
  ObsidianFileSource,
  ChannelSource,
  type InboundMessage,
} from '../messaging/index.js';

function collectStream(): Writable & { text: () => string } {
  let buf = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf += chunk.toString();
      cb();
    },
  }) as Writable & { text: () => string };
  stream.text = () => buf;
  return stream;
}

describe('StdinSource', () => {
  it('emits inbound messages line-by-line and echoes replies to output', async () => {
    const input = Readable.from(['hi\n', 'how are you?\n', '\n']);
    const output = collectStream();
    const src = new StdinSource({ input, output, prompt: '$ ', author: 'reus', channel: 'local' });

    const received: InboundMessage[] = [];
    src.onMessage((m) => void received.push(m));

    await src.start();
    await new Promise((r) => setTimeout(r, 50));

    await src.reply({ channel: 'local', text: 'reply-1' });
    await src.stop();

    expect(received.map((m) => m.text)).toEqual(['hi', 'how are you?']);
    expect(received[0].author).toBe('reus');
    expect(received[0].source).toBe('stdin');
    expect(output.text()).toContain('reply-1');
    expect(output.text()).toContain('$ ');
  });
});

describe('HttpSource', () => {
  it('POST /inbox emits a message and GET /outbox returns replies', async () => {
    const src = new HttpSource({ port: 0 });
    await src.start();
    const { port, host } = src.address()!;

    const received: InboundMessage[] = [];
    src.onMessage((m) => void received.push(m));

    const postRes = await fetch(`http://${host}:${port}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'web-user', text: '안녕', channel: 'web' }),
    });
    expect(postRes.status).toBe(202);

    await new Promise((r) => setTimeout(r, 20));
    expect(received.length).toBe(1);
    expect(received[0].text).toBe('안녕');
    expect(received[0].author).toBe('web-user');

    await src.reply({ channel: 'web', text: '응답입니다', inReplyTo: received[0].id });

    const outboxRes = await fetch(`http://${host}:${port}/outbox`);
    const body = (await outboxRes.json()) as { messages: Array<{ text: string }> };
    expect(body.messages.length).toBe(1);
    expect(body.messages[0].text).toBe('응답입니다');

    await src.stop();
  });

  it('rejects requests without the bearer token when authToken is set', async () => {
    const src = new HttpSource({ port: 0, authToken: 's3cret' });
    await src.start();
    const { port, host } = src.address()!;

    const noAuth = await fetch(`http://${host}:${port}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'x', text: 'hi' }),
    });
    expect(noAuth.status).toBe(401);

    const withAuth = await fetch(`http://${host}:${port}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer s3cret' },
      body: JSON.stringify({ author: 'x', text: 'hi' }),
    });
    expect(withAuth.status).toBe(202);

    await src.stop();
  });
});

describe('ObsidianFileSource', () => {
  it('reads new inbox lines and appends outbox replies', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'semo-vault-'));
    const src = new ObsidianFileSource({ vaultPath: vault, pollMs: 50 });
    const received: InboundMessage[] = [];
    src.onMessage((m) => void received.push(m));

    await src.start();

    // Append a line (after start so offset state is committed first).
    await fs.appendFile(path.join(vault, 'INBOX.md'), '@planclaw 테스트 메시지\n', 'utf8');

    await new Promise((r) => setTimeout(r, 250));
    expect(received.length).toBeGreaterThan(0);
    const msg = received[received.length - 1];
    expect(msg.text).toContain('테스트 메시지');
    expect(msg.source).toBe('obsidian-file');

    await src.reply({ channel: 'obsidian', text: '응답 from SEMO', inReplyTo: msg.id });
    const outbox = await fs.readFile(path.join(vault, 'OUTBOX.md'), 'utf8');
    expect(outbox).toContain('응답 from SEMO');

    await src.stop();
    await fs.rm(vault, { recursive: true, force: true });
  });

  it('does not re-emit lines already processed across restart', async () => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'semo-vault-'));
    await fs.writeFile(path.join(vault, 'INBOX.md'), '첫 메시지\n', 'utf8');

    const src1 = new ObsidianFileSource({ vaultPath: vault, pollMs: 50 });
    const received1: InboundMessage[] = [];
    src1.onMessage((m) => void received1.push(m));
    await src1.start();
    await new Promise((r) => setTimeout(r, 100));
    await src1.stop();
    const initialCount = received1.length;

    const src2 = new ObsidianFileSource({ vaultPath: vault, pollMs: 50 });
    const received2: InboundMessage[] = [];
    src2.onMessage((m) => void received2.push(m));
    await src2.start();
    await new Promise((r) => setTimeout(r, 100));
    await src2.stop();

    // 같은 라인을 두 번 emit 하지 않아야 함.
    expect(received2.length).toBe(0);
    expect(initialCount).toBeGreaterThanOrEqual(1);

    await fs.rm(vault, { recursive: true, force: true });
  });
});

describe('ChannelSource (slack/discord wrapper)', () => {
  it('push() emits inbound messages, reply() delegates to handler', async () => {
    const replies: string[] = [];
    const src = new ChannelSource({
      id: 'slack',
      replyHandler: async (m) => void replies.push(m.text),
    });
    await src.start();
    const received: InboundMessage[] = [];
    src.onMessage((m) => void received.push(m));

    src.push({
      id: 'evt-1',
      source: 'slack',
      channel: 'C123',
      author: 'U123',
      text: '@semobot 안녕',
      receivedAt: new Date().toISOString(),
    });
    expect(received.length).toBe(1);
    expect(received[0].channel).toBe('C123');

    await src.reply({ channel: 'C123', text: '응답' });
    expect(replies).toEqual(['응답']);
    await src.stop();
  });
});

describe('MessageSource async iterator (inbox)', () => {
  it('for-await yields messages and terminates on stop', async () => {
    const src = new ChannelSource({ id: 'x', replyHandler: async () => {} });
    await src.start();

    const iter = (async () => {
      const out: string[] = [];
      for await (const m of src.inbox()) out.push(m.text);
      return out;
    })();

    src.push({
      id: '1',
      source: 'x',
      channel: 'c',
      text: 'a',
      receivedAt: new Date().toISOString(),
    });
    src.push({
      id: '2',
      source: 'x',
      channel: 'c',
      text: 'b',
      receivedAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 10));
    await src.stop();

    const collected = await iter;
    expect(collected).toEqual(['a', 'b']);
  });
});
