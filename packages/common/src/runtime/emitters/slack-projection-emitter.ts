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
  ProjectionFailureKind,
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
        errorCode: 'unsupported_channel',
        failureKind: 'permanent',
        retryable: false,
        attempts: 1,
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
        attempts: 1,
      };
    } catch (err) {
      const { code, kind } = classifySlackError(err);
      return {
        channel: 'slack-block',
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
 * Slack WebAPI 에러 분류 (Codex P6-2/3/4 review (e) 권고).
 *
 * Slack SDK 에러 객체의 `data.error` 또는 `code` 필드를 검사.
 * 기본 매핑:
 *   - 5xx / rate_limited / 429 / network ETIMEDOUT      → transient
 *   - invalid_auth / not_authed / channel_not_found
 *     not_in_channel / 4xx (except 429)                  → permanent
 *   - 미분류                                              → unknown
 */
function classifySlackError(err: unknown): {
  code: string;
  kind: ProjectionFailureKind;
} {
  const e = err as { data?: { error?: string }; code?: string; message?: string; status?: number };
  const slackErr = e?.data?.error ?? e?.code ?? '';
  const status = e?.status;

  const PERMANENT = new Set([
    'invalid_auth',
    'not_authed',
    'token_revoked',
    'channel_not_found',
    'not_in_channel',
    'is_archived',
    'msg_too_long',
    'invalid_blocks',
    'invalid_arguments',
    'no_text',
  ]);
  const TRANSIENT = new Set([
    'rate_limited',
    'service_unavailable',
    'fatal_error',
    'request_timeout',
    'internal_error',
  ]);

  if (PERMANENT.has(slackErr)) return { code: slackErr, kind: 'permanent' };
  if (TRANSIENT.has(slackErr)) return { code: slackErr, kind: 'transient' };
  if (typeof status === 'number') {
    if (status === 429 || status >= 500) return { code: String(status), kind: 'transient' };
    if (status >= 400 && status < 500) return { code: String(status), kind: 'permanent' };
  }
  if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNRESET' || e?.code === 'ENOTFOUND') {
    return { code: e.code, kind: 'transient' };
  }
  return { code: slackErr || 'unknown', kind: 'unknown' };
}
