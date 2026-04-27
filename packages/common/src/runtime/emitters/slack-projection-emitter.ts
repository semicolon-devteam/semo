/**
 * SlackProjectionEmitter — Slack chat.postMessage 를 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2e: common 으로 이동. channel-slack/discord-router 양쪽 라우터가 공용으로 import 가능.
 * 기존 channel-slack/src/slack-projection-emitter.ts 는 re-export facade 로 유지.
 */

import type { WebClient } from '@slack/web-api';
import { convertMarkdownToBlocks } from '../../slack/markdown-to-slack.js';
import type {
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../projection-emitter.js';

export interface SlackEmitterOptions {
  /** bot 식별자별 username/icon_emoji 매핑 (정적). */
  botProfiles?: Record<string, { username: string; icon_emoji: string }>;
  /** botProfiles 가 동적으로 갱신되는 경우 매 emit 시 호출되는 getter. */
  getBotProfiles?: () => Record<string, { username: string; icon_emoji: string }>;
}

interface SlackEmitOptions {
  threadTs?: string;
  botId?: string;
  unfurlLinks?: boolean;
}

export class SlackProjectionEmitter implements ProjectionEmitter {
  constructor(
    private readonly slackWeb: WebClient,
    private readonly options: SlackEmitterOptions = {},
  ) {}

  async emit(target: ProjectionTarget, payload: ProjectionPayload): Promise<ProjectionResult> {
    if (target.channel !== 'slack-block') {
      return {
        channel: target.channel,
        ok: false,
        error: `SlackProjectionEmitter 는 channel='slack-block' 만 지원 (got '${target.channel}')`,
      };
    }
    const opts = (target.options ?? {}) as SlackEmitOptions;
    const profiles = this.options.getBotProfiles?.() ?? this.options.botProfiles ?? {};
    const profile = opts.botId ? profiles[opts.botId] : undefined;
    const payloads = convertMarkdownToBlocks(payload.text);

    let lastTs: string | undefined;
    try {
      for (const p of payloads) {
        const res = await this.slackWeb.chat.postMessage({
          channel: target.destination,
          text: p.text,
          ...(p.blocks.length > 0 && { blocks: p.blocks }),
          thread_ts: opts.threadTs,
          unfurl_links: opts.unfurlLinks ?? false,
          ...(profile && { username: profile.username, icon_emoji: profile.icon_emoji }),
        });
        if (res.ts) lastTs = res.ts;
      }
      return {
        channel: 'slack-block',
        ok: true,
        channelMessageId: lastTs,
      };
    } catch (err) {
      return {
        channel: 'slack-block',
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
