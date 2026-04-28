import { describe, expect, it, vi } from 'vitest';
import { SlackProjectionEmitter } from '../runtime/emitters/slack-projection-emitter.js';
import { DiscordProjectionEmitter } from '../runtime/emitters/discord-projection-emitter.js';
import { CompositeProjectionEmitter } from '../runtime/emitters/composite-emitter.js';
import { ConsoleProjectionEmitter } from '../runtime/emitters/console-emitter.js';
import type { ProjectionEmitter, ProjectionTarget } from '../runtime/projection-emitter.js';

/**
 * P6-6 단위 테스트.
 *
 * Codex P6-2/3/4 review (e) 권고: ProjectionResult 에 failureKind/errorCode/retryable/attempts
 * 추가. retry queue 가 transient 만 재시도하도록 분류.
 */

const SLACK_TARGET: ProjectionTarget = { channel: 'slack-block', destination: 'C123' };
const DISCORD_TARGET: ProjectionTarget = { channel: 'discord-embed', destination: '123' };
const PAYLOAD = { text: 'hello' };

function makeFakeSlackWeb(throwErr: unknown) {
  return {
    chat: {
      postMessage: vi.fn(() => Promise.reject(throwErr)),
    },
  } as never;
}

function makeFakeDiscordGateway(throwErr: unknown) {
  return {
    postAsBot: vi.fn(() => Promise.reject(throwErr)),
  } as never;
}

describe('SlackProjectionEmitter failure classification (P6-6)', () => {
  it('rate_limited → transient/retryable', async () => {
    const emitter = new SlackProjectionEmitter(
      makeFakeSlackWeb({ data: { error: 'rate_limited' } }),
    );
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('rate_limited');
    expect(r.failureKind).toBe('transient');
    expect(r.retryable).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it('channel_not_found → permanent/non-retryable', async () => {
    const emitter = new SlackProjectionEmitter(
      makeFakeSlackWeb({ data: { error: 'channel_not_found' } }),
    );
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
    expect(r.retryable).toBe(false);
  });

  it('invalid_auth → permanent', async () => {
    const emitter = new SlackProjectionEmitter(
      makeFakeSlackWeb({ data: { error: 'invalid_auth' } }),
    );
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
  });

  it('http 503 → transient', async () => {
    const emitter = new SlackProjectionEmitter(makeFakeSlackWeb({ status: 503, data: {} }));
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('transient');
    expect(r.errorCode).toBe('503');
  });

  it('http 400 → permanent', async () => {
    const emitter = new SlackProjectionEmitter(makeFakeSlackWeb({ status: 400, data: {} }));
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
  });

  it('ETIMEDOUT → transient', async () => {
    const emitter = new SlackProjectionEmitter(makeFakeSlackWeb({ code: 'ETIMEDOUT' }));
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('transient');
    expect(r.errorCode).toBe('ETIMEDOUT');
  });

  it('미분류 에러 → unknown (retryable 아님 — outbox 정책이 결정)', async () => {
    const emitter = new SlackProjectionEmitter(
      makeFakeSlackWeb({ data: { error: 'unexpected_thing' } }),
    );
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('unknown');
    expect(r.retryable).toBe(false);
  });

  it('지원 안 하는 채널 → permanent', async () => {
    const emitter = new SlackProjectionEmitter(makeFakeSlackWeb(new Error('never')));
    const r = await emitter.emit(DISCORD_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
    expect(r.errorCode).toBe('unsupported_channel');
  });
});

describe('DiscordProjectionEmitter failure classification (P6-6)', () => {
  it('http 429 → transient', async () => {
    const emitter = new DiscordProjectionEmitter(makeFakeDiscordGateway({ status: 429 }));
    const r = await emitter.emit(DISCORD_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('transient');
  });

  it('discord code 50001 (missing access) → permanent', async () => {
    const emitter = new DiscordProjectionEmitter(
      makeFakeDiscordGateway({ code: 50001, status: 403 }),
    );
    const r = await emitter.emit(DISCORD_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
    expect(r.errorCode).toBe('50001');
  });

  it('discord code 10003 (unknown channel) → permanent', async () => {
    const emitter = new DiscordProjectionEmitter(
      makeFakeDiscordGateway({ code: 10003, status: 404 }),
    );
    const r = await emitter.emit(DISCORD_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
  });

  it('5xx → transient', async () => {
    const emitter = new DiscordProjectionEmitter(makeFakeDiscordGateway({ status: 502 }));
    const r = await emitter.emit(DISCORD_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('transient');
  });

  it('지원 안 하는 채널 → permanent', async () => {
    const emitter = new DiscordProjectionEmitter(makeFakeDiscordGateway(new Error('never')));
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
  });
});

describe('CompositeProjectionEmitter failure classification (P6-6)', () => {
  it('등록 안 된 채널 → permanent / no_delegate', async () => {
    const composite = new CompositeProjectionEmitter();
    const r = await composite.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
    expect(r.errorCode).toBe('no_delegate');
  });

  it('delegate.emit throw → unknown / retryable', async () => {
    const throwingEmitter: ProjectionEmitter = {
      async emit() {
        throw new Error('boom');
      },
      async emitAll() {
        throw new Error('boom');
      },
    };
    const composite = new CompositeProjectionEmitter().register('slack-block', throwingEmitter);
    const r = await composite.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('unknown');
    expect(r.errorCode).toBe('delegate_threw');
    expect(r.retryable).toBe(true);
  });
});

describe('ConsoleProjectionEmitter (P6-6)', () => {
  it('성공: attempts=1', async () => {
    const emitter = new ConsoleProjectionEmitter({ useStderr: true });
    const r = await emitter.emit({ channel: 'console', destination: 'planclaw' }, { text: 'hi' });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it('지원 안 하는 채널 → permanent', async () => {
    const emitter = new ConsoleProjectionEmitter();
    const r = await emitter.emit(SLACK_TARGET, PAYLOAD);
    expect(r.failureKind).toBe('permanent');
  });
});
