/**
 * DiscordProjectionEmitter — DiscordGateway 의 postAsBot 흐름을 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2e: common 으로 이동. discord-router/slack-router 등 외부에서 공용으로 import 가능.
 * 기존 discord-router/src/discord-projection-emitter.ts 는 re-export facade 로 유지.
 */

import type { GatewayAdapter } from '../../mailbox/outbox-reader.js';
import type {
  ProjectionEmitter,
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
      };
    }
    const opts = (target.options ?? {}) as DiscordEmitOptions;
    const botId = opts.botId ?? 'semiclaw';
    try {
      await this.gateway.postAsBot(botId, target.destination, payload.text, opts.threadTs);
      return {
        channel: 'discord-embed',
        ok: true,
      };
    } catch (err) {
      return {
        channel: 'discord-embed',
        ok: false,
        error: (err as Error).message,
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
