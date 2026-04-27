/**
 * DiscordProjectionEmitter — DiscordGateway 의 postAsBot 흐름을 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2b 단계: 인터페이스 노출만 — 기존 outbox-reader 흐름은 변경하지 않는다.
 * 합류(기존 호출처가 emitter 사용)는 P5-2c 에서 단계적 진행.
 */

import type {
  GatewayAdapter,
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '@team-semicolon/semo-common';

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
