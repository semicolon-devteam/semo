/**
 * SlackProjectionEmitter — Slack chat.postMessage 를 ProjectionEmitter 인터페이스 뒤로 wrap.
 *
 * P5-2e: common 으로 이동. channel-slack/discord-router 양쪽 라우터가 공용으로 import 가능.
 * 기존 channel-slack/src/slack-projection-emitter.ts 는 re-export facade 로 유지.
 *
 * 2026-05-07: username/icon_emoji 위장 제거. 발신 시 botId 별 WebClient 풀에서
 * 진짜 봇 Slack App 토큰을 골라 chat.postMessage 한다. 토큰 누락 시 fallback WebClient.
 */

import type { WebClient } from '@slack/web-api';
import { convertMarkdownToBlocks } from '../../slack/markdown-to-slack.js';
import { getWebClientForBot } from '../../slack/bot-web-client-pool.js';
import type {
  ProjectionEmitter,
  ProjectionFailureKind,
  ProjectionPayload,
  ProjectionResult,
  ProjectionTarget,
} from '../projection-emitter.js';

export interface SlackEmitterOptions {
  /**
   * botId → WebClient 매핑을 override 할 때 사용 (테스트용).
   * 기본값은 bot-web-client-pool.getWebClientForBot.
   */
  resolveWebClient?: (botId: string | undefined) => WebClient;
}

interface SlackEmitOptions {
  threadTs?: string;
  botId?: string;
  unfurlLinks?: boolean;
}

export class SlackProjectionEmitter implements ProjectionEmitter {
  constructor(
    /** Fallback WebClient — botId 없거나 풀에서 못 찾으면 이걸 사용. */
    private readonly fallbackWeb: WebClient,
    private readonly options: SlackEmitterOptions = {},
  ) {}

  private resolveClient(botId: string | undefined): WebClient {
    if (this.options.resolveWebClient) return this.options.resolveWebClient(botId);
    if (!botId) return this.fallbackWeb;
    return getWebClientForBot(botId);
  }

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
    const web = this.resolveClient(opts.botId);
    const payloads = convertMarkdownToBlocks(payload.text);

    let lastTs: string | undefined;
    try {
      for (const p of payloads) {
        const res = await web.chat.postMessage({
          channel: target.destination,
          text: p.text,
          ...(p.blocks.length > 0 && { blocks: p.blocks }),
          thread_ts: opts.threadTs,
          unfurl_links: opts.unfurlLinks ?? false,
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
