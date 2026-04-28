/**
 * DiscordProjectionEmitter — DiscordGateway 의 postAsBot 흐름을 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2e: common 으로 이동. discord-router/slack-router 등 외부에서 공용으로 import 가능.
 * 기존 discord-router/src/discord-projection-emitter.ts 는 re-export facade 로 유지.
 */

import type { GatewayAdapter } from '../../mailbox/outbox-reader.js';
import type {
  ProjectionEmitter,
  ProjectionFailureKind,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../projection-emitter.js';

interface DiscordEmitOptions {
  threadTs?: string;
  botId?: string;
}

export class DiscordProjectionEmitter implements ProjectionEmitter {
  constructor(private readonly gateway: GatewayAdapter) {}

  async emit(target: ProjectionTarget, payload: ProjectionPayload): Promise<ProjectionResult> {
    if (target.channel !== 'discord-embed') {
      return {
        channel: target.channel,
        ok: false,
        error: `DiscordProjectionEmitter 는 channel='discord-embed' 만 지원 (got '${target.channel}')`,
        errorCode: 'unsupported_channel',
        failureKind: 'permanent',
        retryable: false,
        attempts: 1,
      };
    }
    const opts = (target.options ?? {}) as DiscordEmitOptions;
    const botId = opts.botId ?? 'semiclaw';
    try {
      await this.gateway.postAsBot(botId, target.destination, payload.text, opts.threadTs);
      return {
        channel: 'discord-embed',
        ok: true,
        attempts: 1,
      };
    } catch (err) {
      const { code, kind } = classifyDiscordError(err);
      return {
        channel: 'discord-embed',
        ok: false,
        error: (err as Error).message,
        errorCode: code,
        failureKind: kind,
        retryable: kind === 'transient',
        attempts: 1,
      };
    }
  }

  async emitAll(
    targets: ProjectionTarget[],
    payload: ProjectionPayload,
  ): Promise<ProjectionResult[]> {
    return Promise.all(targets.map((t) => this.emit(t, payload)));
  }
}

/**
 * Discord API 에러 분류 (Codex P6-2/3/4 review (e) 권고).
 *
 * Discord REST 에러는 보통 `{ code: number, message: string, status?: number }` 형태.
 *  - 5xx / 429 / network ETIMEDOUT                       → transient
 *  - 401 (unauthorized) / 403 (missing access) /
 *    404 (unknown channel) / 4xx (제외 429)              → permanent
 *  - 미분류                                               → unknown
 */
function classifyDiscordError(err: unknown): {
  code: string;
  kind: ProjectionFailureKind;
} {
  const e = err as { code?: number | string; status?: number; message?: string };
  const status = e?.status;
  const code = e?.code !== undefined ? String(e.code) : '';

  if (typeof status === 'number') {
    if (status === 429 || status >= 500) return { code: code || String(status), kind: 'transient' };
    if (status >= 400 && status < 500) return { code: code || String(status), kind: 'permanent' };
  }
  // Discord 자체 코드: https://discord.com/developers/docs/topics/opcodes-and-status-codes
  // 10003 unknown channel, 50001 missing access, 50013 missing permissions, 50007 cannot send DM
  const PERMANENT_CODES = new Set(['10003', '50001', '50013', '50007', '40005']);
  if (PERMANENT_CODES.has(code)) return { code, kind: 'permanent' };

  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNRESET' || e?.code === 'ENOTFOUND') {
    return { code: String(e.code), kind: 'transient' };
  }
  return { code: code || 'unknown', kind: 'unknown' };
}
