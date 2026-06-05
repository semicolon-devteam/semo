import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { convertMarkdownToBlocks } from './markdown-to-slack.js';
import type { SlackMessage, SlackImage, AskOption } from './channel-types.js';
import { type BotId } from './bot-config.js';
import { getWebClientForBot } from './bot-web-client-pool.js';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

/**
 * 채널 ID allowlist — 이 채널들에서는 사용자가 봇을 @mention 하지 않아도 모든
 * 사용자 메시지를 ingest 한다. #bot-ops 등 봇 운영 전용 채널에 사용.
 * 기본 동작 (멘션 없으면 drop) 은 #일반 채널 noise 차단을 위함이지만, 봇 운영
 * 채널에서는 사용자가 매번 멘션을 붙이는 것이 비현실적이라 envvar 로 화이트리스트.
 *
 * 형식: 콤마 구분 channel ID. 예: SEMO_FULL_INGEST_CHANNELS=C0AFBQ209E0,C09KNL91QBZ
 */
export function parseFullIngestChannels(raw: string | undefined, enabled: boolean): Set<string> {
  if (!enabled) return new Set();
  return new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

const FULL_INGEST_CHANNELS = parseFullIngestChannels(
  process.env.SEMO_FULL_INGEST_CHANNELS,
  process.env.SEMO_ENABLE_FULL_INGEST === '1' || process.env.SEMO_ENABLE_FULL_INGEST === 'true',
);

/** magic bytes로 실제 이미지 파일인지 검증 */
function isValidImageMagic(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.length >= 12 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return true;
  return false;
}

/** 봇 메시지 중 오케스트레이터가 처리해야 할 시스템 메시지 패턴 */
export const SYSTEM_MESSAGE_PATTERNS = [
  /\[Route:\s*\w+\]/, // 명시적 라우팅 태그
  /\[GFP:/, // GFP 파이프라인 콜백
  /\[Dashboard:/, // 대시보드 알림
  /\[System:/, // 범용 시스템 메시지
  /\[Dispatch:/, // 디스패치 메시지
];

export function isSystemMessage(text: string | undefined): boolean {
  if (!text) return false;
  return SYSTEM_MESSAGE_PATTERNS.some((p) => p.test(text));
}

export interface SlackEventProcessingInput {
  event: {
    user?: string;
    bot_id?: string;
    text?: string;
  };
  botUserId: string;
  botBotId: string;
  allowBotMessage?: boolean;
}

export function shouldProcessSlackEvent({
  event,
  botUserId,
  botBotId,
  allowBotMessage = false,
}: SlackEventProcessingInput): boolean {
  if (event.user && event.user === botUserId) return false;
  if (!event.bot_id) return true;
  if (event.bot_id === botBotId) return false;
  if (allowBotMessage) return true;
  return isSystemMessage(event.text);
}

export type MessageHandler = (msg: SlackMessage, senderName: string) => Promise<void>;

export class SlackGateway {
  private web: WebClient;
  private socket: SocketModeClient;
  private botUserId = '';
  private botBotId = ''; // bot_id (user_id와 별도 — 봇 메시지 식별용)
  private onMessage: MessageHandler | null = null;
  private readonly routeBotId?: string;

  // Busy state + queue (serial processing per thread)
  private busyThreads = new Set<string>();
  private busyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private messageQueue: Array<{ msg: SlackMessage; senderName: string }> = [];
  private readonly BUSY_TIMEOUT_MS = 5 * 60 * 1000; // 5분 후 자동 해제

  // Event dedup — same message ts processed only once (app_mention + message race)
  private processedEvents = new Set<string>();
  private readonly PROCESSED_EVENTS_MAX = 200;

  constructor(botToken: string, appToken: string, routeBotId?: string) {
    this.web = new WebClient(botToken);
    this.socket = new SocketModeClient({ appToken });
    this.routeBotId = routeBotId;
  }

  /** P5-2e: SlackProjectionEmitter 등 외부에서 WebClient 가 필요할 때 사용. */
  getWebClient(): WebClient {
    return this.web;
  }

  getBotUserId(): string {
    return this.botUserId;
  }

  getRouteBotId(): string | undefined {
    return this.routeBotId;
  }

  setMessageHandler(handler: MessageHandler) {
    this.onMessage = handler;
  }

  async start() {
    // Resolve bot user ID
    const auth = await this.web.auth.test();
    this.botUserId = auth.user_id || '';
    this.botBotId = auth.bot_id || '';
    console.log(
      `[slack] Bot user: ${this.botUserId}, bot_id: ${this.botBotId}` +
        `${this.routeBotId ? `, route_bot_id: ${this.routeBotId}` : ''}`,
    );

    // app_mention events — 봇 멘션 시 처리
    this.socket.on('app_mention', async ({ event, ack }) => {
      try {
        await ack();
      } catch (e) {
        console.error('[slack] ack failed (app_mention), skipping:', (e as Error).message);
        return;
      }
      await this.handleEvent(event, { allowBotMessage: true });
    });

    // message events — DM, 시스템 메시지만 처리 (채널 메시지는 app_mention으로 수신)
    this.socket.on('message', async ({ event, ack }) => {
      try {
        await ack();
      } catch (e) {
        console.error('[slack] ack failed (message), skipping:', (e as Error).message);
        return;
      }
      const isSysMsg = isSystemMessage(event.text);
      if (event.bot_id && !isSysMsg) return;

      if (event.channel_type === 'im' || isSysMsg || FULL_INGEST_CHANNELS.has(event.channel)) {
        await this.handleEvent(event);
      }
    });

    // Interactive (ask_user buttons)
    this.socket.on('interactive', async ({ body, ack }) => {
      try {
        await ack();
      } catch (e) {
        console.error('[slack] ack failed (interactive), skipping:', (e as Error).message);
        return;
      }
      if (body.type === 'block_actions' && body.actions) {
        for (const action of body.actions) {
          const match = (action.action_id || '').match(/^semo_ask_(.+)_\d+$/);
          if (match) {
            const requestId = match[1];
            const resolve = this.pendingAskResponses.get(requestId);
            if (resolve) {
              this.pendingAskResponses.delete(requestId);
              resolve(action.value || action.text?.text || 'selected');
              try {
                const userName = body.user?.name || 'User';
                await this.web.chat.update({
                  channel: body.channel?.id || '',
                  ts: body.message?.ts || '',
                  text: `:white_check_mark: *${userName}* 선택: ${action.value || action.text?.text}`,
                  blocks: [],
                });
              } catch {
                /* update 실패해도 응답은 전달 */
              }
            }
            continue;
          }
          // "자세히 보기" 버튼 → 저장된 상세를 같은 스레드에 펼친다.
          const detailMatch = (action.action_id || '').match(/^semo_detail_(.+)$/);
          if (detailMatch) {
            const entry = this.pendingDetails.get(detailMatch[1]);
            if (entry) {
              try {
                const web = getWebClientForBot(entry.botId);
                const threadTs = body.message?.thread_ts || body.message?.ts;
                for (const p of convertMarkdownToBlocks(entry.detail)) {
                  await web.chat.postMessage({
                    channel: body.channel?.id || '',
                    text: p.text,
                    ...(p.blocks.length > 0 && { blocks: p.blocks }),
                    thread_ts: threadTs || undefined,
                    unfurl_links: false,
                  });
                }
              } catch (e) {
                console.error('[slack] detail expand failed:', (e as Error).message);
              }
            }
          }
        }
      }
    });

    await this.socket.start();
    console.log('[slack] Socket Mode connected');
  }

  private async handleEvent(event: any, opts: { allowBotMessage?: boolean } = {}) {
    if (
      !shouldProcessSlackEvent({
        event,
        botUserId: this.botUserId,
        botBotId: this.botBotId,
        allowBotMessage: opts.allowBotMessage,
      })
    )
      return;

    // Dedup: skip if same event.ts already processed (app_mention + message race)
    if (this.processedEvents.has(event.ts)) return;
    this.processedEvents.add(event.ts);
    if (this.processedEvents.size > this.PROCESSED_EVENTS_MAX) {
      const first = this.processedEvents.values().next().value;
      if (first) this.processedEvents.delete(first);
    }

    const cleanText = (event.text || '')
      .replace(new RegExp(`<@${this.botUserId}>\\s*`, 'g'), '')
      .trim();
    if (!cleanText) return;

    // :eyes: 리액션
    try {
      await this.web.reactions.add({ name: 'eyes', channel: event.channel, timestamp: event.ts });
    } catch {
      /* already reacted */
    }

    // 유저 정보 조회
    let senderName = event.user || event.bot_id || 'bot';
    try {
      if (event.user) {
        const info = await this.web.users.info({ user: event.user });
        senderName = info.user?.profile?.display_name || info.user?.real_name || event.user;
      } else if (event.username || event.bot_profile?.name) {
        senderName = event.username || event.bot_profile.name;
      }
    } catch {
      /* fallback to user ID */
    }

    // 이미지 파일 다운로드 (API 지원 포맷만, 5MB 이하)
    const SUPPORTED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — Claude API 제한
    const images: SlackImage[] = [];
    if (event.files && Array.isArray(event.files)) {
      const tmpDir = path.join(os.tmpdir(), 'semo-slack-images');
      fs.mkdirSync(tmpDir, { recursive: true });
      for (const file of event.files) {
        const mime = file.mimetype || '';
        if (!SUPPORTED_IMAGE_MIMES.has(mime)) continue;
        // url_private_download만 사용 — url_private는 HTML 미리보기일 수 있음
        const downloadUrl = file.url_private_download;
        if (!downloadUrl) continue;
        try {
          const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > MAX_IMAGE_BYTES) {
            console.log(
              `[slack-gw] Skipping oversized image: ${file.name} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`,
            );
            continue;
          }
          // magic bytes 검증 — 실제 이미지인지 확인
          if (!isValidImageMagic(buf)) {
            console.log(`[slack-gw] Skipping invalid image data: ${file.name}`);
            continue;
          }
          const ext = mime.split('/')[1] || 'png';
          const localPath = path.join(tmpDir, `${event.ts}-${file.id}.${ext}`);
          fs.writeFileSync(localPath, buf);
          images.push({ name: file.name || 'image', media_type: mime, localPath });
        } catch {
          // 다운로드 실패 시 skip
        }
      }
    }

    const msg: SlackMessage = {
      text: cleanText,
      user: event.user || event.bot_id || 'bot',
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      bot_id: event.bot_id,
      route_bot_id: this.routeBotId,
      ...(images.length > 0 && { images }),
    };

    const threadKey = event.thread_ts || event.ts;

    // Busy check — queue if thread is busy
    if (this.busyThreads.has(threadKey)) {
      await this.setTypingStatus(
        event.channel,
        threadKey,
        '다른 질문에 답변 중입니다. 잠시 후 응답합니다.',
      );
      this.messageQueue.push({ msg, senderName });
      return;
    }

    this.busyThreads.add(threadKey);
    // 타임아웃 — onMessage가 hang되면 자동 해제
    this.busyTimers.set(
      threadKey,
      setTimeout(() => {
        console.error(`[slack] busy timeout for thread ${threadKey} — auto-clearing`);
        this.busyThreads.delete(threadKey);
        this.busyTimers.delete(threadKey);
      }, this.BUSY_TIMEOUT_MS),
    );

    await this.setTypingStatus(event.channel, threadKey, '질문을 분석하고 있어요...');

    try {
      if (this.onMessage) await this.onMessage(msg, senderName);
    } finally {
      this.busyThreads.delete(threadKey);
      const timer = this.busyTimers.get(threadKey);
      if (timer) {
        clearTimeout(timer);
        this.busyTimers.delete(threadKey);
      }
      // Process queued messages for this thread
      const nextIdx = this.messageQueue.findIndex(
        (q) => (q.msg.thread_ts || q.msg.ts) === threadKey,
      );
      if (nextIdx >= 0) {
        const next = this.messageQueue.splice(nextIdx, 1)[0];
        setImmediate(() => this.handleEvent({ ...next.msg, user: next.msg.user }));
      }
    }
  }

  // ── Public API ──

  async getThreadHistory(
    channel: string,
    threadTs: string,
    limit = 15,
  ): Promise<import('./channel-types').ThreadMessage[]> {
    try {
      const result = await this.web.conversations.replies({
        channel,
        ts: threadTs,
        limit: limit + 1,
      });
      const messages = result.messages || [];
      // 마지막 메시지(현재 메시지) 제외, 부모 메시지는 포함
      const history = messages.slice(0, -1);
      return history.map((m) => ({
        displayName: ((m as Record<string, unknown>).username as string) || m.user || 'unknown',
        text:
          (m.text || '').length > 500 ? (m.text || '').slice(0, 500) + '...(잘림)' : m.text || '',
        isBotMessage: !!m.bot_id,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 채널 최근 메시지 (top-level). thread 가 아닌 "오늘/최근 채널에서 무슨 얘기 했지?"
   * 류의 회상·요약 요청을 위해 conversations.history 를 사용.
   * Slack API 는 최신순으로 반환하므로 시간순(오래된→최신)으로 뒤집어 돌려준다.
   */
  async getChannelHistory(
    channel: string,
    opts: { limit?: number; oldestTs?: string; excludeTs?: string } = {},
  ): Promise<import('./channel-types').ThreadMessage[]> {
    const limit = opts.limit ?? 30;
    try {
      const result = await this.web.conversations.history({
        channel,
        limit,
        ...(opts.oldestTs ? { oldest: opts.oldestTs } : {}),
      });
      const messages = (result.messages || [])
        .filter((m) => !opts.excludeTs || m.ts !== opts.excludeTs)
        .reverse(); // newest-first → chronological
      return messages.map((m) => ({
        displayName: ((m as Record<string, unknown>).username as string) || m.user || 'unknown',
        text:
          (m.text || '').length > 500 ? (m.text || '').slice(0, 500) + '...(잘림)' : m.text || '',
        isBotMessage: !!m.bot_id,
      }));
    } catch {
      return [];
    }
  }

  async postAsBot(botId: string, channel: string, text: string, threadTs?: string): Promise<void> {
    // 2026-05-07: username/icon_emoji 위장 제거. 봇별 Slack App 토큰의 WebClient 로 직접 발신.
    // 봇별 토큰이 없으면 SemoBot fallback (bot-web-client-pool 내부에서 처리).
    const web = getWebClientForBot(botId);
    const payloads = convertMarkdownToBlocks(text);

    for (const payload of payloads) {
      await web.chat.postMessage({
        channel,
        text: payload.text,
        ...(payload.blocks.length > 0 && { blocks: payload.blocks }),
        thread_ts: threadTs || undefined,
        unfurl_links: false,
      });
    }
  }

  // "자세히 보기" 접힘: 결론(summary)을 본문으로 게시하고, 상세(detail)는 버튼 클릭 시
  // 같은 스레드에 펼친다. Slack 은 네이티브 접힘 섹션이 없으므로 actions 버튼으로 on-demand 노출한다.
  private pendingDetails = new Map<string, { botId: string; detail: string }>();
  private detailCounter = 0;

  async postWithDetail(
    botId: string,
    channel: string,
    summary: string,
    detail: string,
    threadTs?: string,
  ): Promise<void> {
    const web = getWebClientForBot(botId);
    const id = `${++this.detailCounter}_${Date.now()}`;
    // 메모리 캡 (best-effort) — 가장 오래된 항목부터 제거.
    if (this.pendingDetails.size > 200) {
      const oldest = this.pendingDetails.keys().next().value;
      if (oldest) this.pendingDetails.delete(oldest);
    }
    this.pendingDetails.set(id, { botId, detail });

    const payloads = convertMarkdownToBlocks(summary);
    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i];
      const blocks: unknown[] = [...p.blocks];
      if (i === payloads.length - 1) {
        if (blocks.length === 0) {
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: p.text || ' ' } });
        }
        blocks.push({
          type: 'actions',
          block_id: `semo_detail_${id}`,
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '자세히 보기' },
              action_id: `semo_detail_${id}`,
              value: id,
            },
          ],
        });
      }
      await web.chat.postMessage({
        channel,
        text: p.text,
        ...(blocks.length > 0 && { blocks: blocks as never }),
        thread_ts: threadTs || undefined,
        unfurl_links: false,
      });
    }
  }

  async setTypingStatus(channel: string, threadTs: string, status: string): Promise<void> {
    try {
      await this.web.assistant.threads.setStatus({
        channel_id: channel,
        thread_ts: threadTs,
        status,
      });
    } catch {
      /* setStatus 실패 시 무시 */
    }
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    try {
      await this.web.reactions.add({ name: emoji, channel, timestamp });
    } catch {
      /* already reacted */
    }
  }

  // ask_user: interactive buttons
  private pendingAskResponses = new Map<string, (value: string) => void>();
  private askCounter = 0;

  async askUser(
    botId: string,
    channel: string,
    question: string,
    options: AskOption[],
    threadTs?: string,
  ): Promise<string> {
    const requestId = `ask_${++this.askCounter}_${Date.now()}`;
    const web = getWebClientForBot(botId);

    const buttons = options.slice(0, 4).map((opt, i) => ({
      type: 'button' as const,
      text: { type: 'plain_text' as const, text: opt.label },
      action_id: `semo_ask_${requestId}_${i}`,
      value: opt.value,
    }));

    await web.chat.postMessage({
      channel,
      thread_ts: threadTs || undefined,
      text: question,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `:question: ${question}` } },
        { type: 'actions', block_id: `semo_ask_${requestId}`, elements: buttons },
      ],
    });

    return new Promise<string>((resolve) => {
      this.pendingAskResponses.set(requestId, resolve);
      setTimeout(() => {
        if (this.pendingAskResponses.has(requestId)) {
          this.pendingAskResponses.delete(requestId);
          resolve('(timeout — 120초 내 응답 없음)');
        }
      }, 120_000);
    });
  }

  /** 기존 메시지 내용을 갱신한다 (chat.update). */
  async updateMessage(channel: string, ts: string, text: string): Promise<void> {
    try {
      await this.web.chat.update({ channel, ts, text });
    } catch (err) {
      console.warn('[slack] updateMessage failed:', err);
    }
  }

  async stop() {
    await this.socket.disconnect();
  }
}
