/**
 * SlackProjectionEmitter — Slack chat.postMessage 를 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2b 단계: 인터페이스 뒤로 노출만 — 기존 reply tool 흐름은 변경하지 않는다.
 * 합류(기존 호출처가 emitter 사용)는 P5-2c 에서 단계적 진행.
 */

import type { WebClient } from '@slack/web-api';
import type {
  ProjectionEmitter,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '@team-semicolon/semo-common';
import { convertMarkdownToBlocks } from './markdown-to-slack.js';

export interface SlackEmitterOptions {
  /** bot 식별자별 username/icon_emoji 매핑 (정적). */
  botProfiles?: Record<string, { username: string; icon_emoji: string }>;
  /** botProfiles 가 동적으로 갱신되는 경우 매 emit 시 호출되는 getter (uses fresh map). */
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
