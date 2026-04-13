import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { convertMarkdownToBlocks } from './markdown-to-slack.js';
import type { SlackMessage, SlackImage, AskOption } from './types';
import { SLACK_PROFILES } from './bot-config';
import type { BotId } from './bot-config';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

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

export type MessageHandler = (msg: SlackMessage, senderName: string) => Promise<void>;

export class SlackGateway {
  private web: WebClient;
  private socket: SocketModeClient;
  private botUserId = '';
  private botBotId = ''; // bot_id (user_id와 별도 — 봇 메시지 식별용)
  private onMessage: MessageHandler | null = null;

  // Busy state + queue (serial processing per thread)
  private busyThreads = new Set<string>();
  private busyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private messageQueue: Array<{ msg: SlackMessage; senderName: string }> = [];
  private readonly BUSY_TIMEOUT_MS = 5 * 60 * 1000; // 5분 후 자동 해제

  // 봇 참여 스레드 추적 — 멘션 또는 응답 성공한 스레드만 캐시
  // Map<threadTs, lastActiveAt> — TTL 2시간, 최대 500개, LRU
  private botThreads = new Map<string, number>();
  private readonly BOT_THREAD_TTL = 2 * 60 * 60_000; // 2시간
  private readonly BOT_THREAD_MAX = 500;

  constructor(botToken: string, appToken: string) {
    this.web = new WebClient(botToken);
    this.socket = new SocketModeClient({ appToken });
  }

  setMessageHandler(handler: MessageHandler) {
    this.onMessage = handler;
  }

  async start() {
    // Resolve bot user ID
    const auth = await this.web.auth.test();
    this.botUserId = auth.user_id || '';
    this.botBotId = auth.bot_id || '';
    console.log(`[slack] Bot user: ${this.botUserId}, bot_id: ${this.botBotId}`);

    // app_mention events — 봇 멘션 시 스레드 등록 + 처리
    this.socket.on('app_mention', async ({ event, ack }) => {
      await ack();
      if (event.bot_id) return; // 봇이 자기 자신을 멘션한 경우 무시
      // 봇이 멘션된 스레드 기록 (스레드 안 멘션 시 thread_ts, 채널 멘션 시 ts)
      const threadKey = event.thread_ts || event.ts;
      this.trackBotThread(threadKey);
      await this.handleEvent(event);
    });

    // message events — DM, 봇 참여 스레드 답글, 시스템 메시지만 처리
    this.socket.on('message', async ({ event, ack }) => {
      await ack();
      const isSysMsg = isSystemMessage(event.text);
      if (event.bot_id && !isSysMsg) return;

      const isThreadReply = event.thread_ts && event.thread_ts !== event.ts;

      if (
        event.channel_type === 'im' ||
        isSysMsg ||
        (isThreadReply && (await this.isBotThread(event.channel, event.thread_ts)))
      ) {
        await this.handleEvent(event);
      }
    });

    // Interactive (ask_user buttons)
    this.socket.on('interactive', async ({ body, ack }) => {
      await ack();
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
          }
        }
      }
    });

    await this.socket.start();
    console.log('[slack] Socket Mode connected');
  }

  private async handleEvent(event: any) {
    if (event.user === this.botUserId) return;
    if (event.bot_id && !isSystemMessage(event.text)) return;

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
    let senderName = event.user;
    try {
      const info = await this.web.users.info({ user: event.user });
      senderName = info.user?.profile?.display_name || info.user?.real_name || event.user;
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
      user: event.user,
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      bot_id: event.bot_id,
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
  ): Promise<import('./types').ThreadMessage[]> {
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

  async postAsBot(botId: string, channel: string, text: string, threadTs?: string): Promise<void> {
    const profile = SLACK_PROFILES[botId];
    const payloads = convertMarkdownToBlocks(text);

    for (const payload of payloads) {
      await this.web.chat.postMessage({
        channel,
        text: payload.text,
        ...(payload.blocks.length > 0 && { blocks: payload.blocks }),
        thread_ts: threadTs || undefined,
        unfurl_links: false,
        ...(profile && { username: profile.username, icon_emoji: profile.icon_emoji }),
      });
    }
    // 응답 성공 후 스레드 등록 — 이후 스레드 답글에 반응하기 위함
    if (threadTs) this.trackBotThread(threadTs);
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
    const profile = SLACK_PROFILES[botId];

    const buttons = options.slice(0, 4).map((opt, i) => ({
      type: 'button' as const,
      text: { type: 'plain_text' as const, text: opt.label },
      action_id: `semo_ask_${requestId}_${i}`,
      value: opt.value,
    }));

    await this.web.chat.postMessage({
      channel,
      thread_ts: threadTs || undefined,
      text: question,
      ...(profile && { username: profile.username, icon_emoji: profile.icon_emoji }),
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

  // ── Bot Thread Tracking ──

  /** 봇 참여 스레드 등록 (LRU: delete+set으로 삽입 순서 갱신) */
  private trackBotThread(threadTs: string): void {
    this.botThreads.delete(threadTs);
    this.botThreads.set(threadTs, Date.now());
    if (this.botThreads.size > this.BOT_THREAD_MAX) {
      const oldest = this.botThreads.keys().next().value;
      if (oldest) this.botThreads.delete(oldest);
    }
  }

  /** 캐시에서 봇 참여 여부 확인 (TTL + LRU 갱신) */
  private isBotThreadCached(threadTs: string): boolean {
    const lastActive = this.botThreads.get(threadTs);
    if (!lastActive) return false;
    if (Date.now() - lastActive > this.BOT_THREAD_TTL) {
      this.botThreads.delete(threadTs);
      return false;
    }
    // LRU 갱신
    this.botThreads.delete(threadTs);
    this.botThreads.set(threadTs, Date.now());
    return true;
  }

  /** 봇 참여 스레드 여부 확인 — 캐시 미스 시 Slack API lazy-check (재시작 복구) */
  private inflightChecks = new Map<string, Promise<boolean>>();

  private async isBotThread(channel: string, threadTs: string): Promise<boolean> {
    if (this.isBotThreadCached(threadTs)) return true;
    // Cache stampede 방지 — 동일 스레드 동시 요청 시 1회만 API 호출
    const key = `${channel}:${threadTs}`;
    if (this.inflightChecks.has(key)) return this.inflightChecks.get(key)!;
    const p = this.fetchIsBotThread(channel, threadTs).finally(() =>
      this.inflightChecks.delete(key),
    );
    this.inflightChecks.set(key, p);
    return p;
  }

  private async fetchIsBotThread(channel: string, threadTs: string): Promise<boolean> {
    try {
      const result = await this.web.conversations.replies({
        channel,
        ts: threadTs,
        limit: 30,
      });
      const botParticipated = result.messages?.some(
        (m) =>
          m.bot_id === this.botBotId ||
          m.user === this.botUserId ||
          (m.text || '').includes(`<@${this.botUserId}>`),
      );
      if (botParticipated) {
        this.trackBotThread(threadTs);
        return true;
      }
    } catch {
      /* API 실패 시 보수적으로 미응답 */
    }
    return false;
  }

  async stop() {
    await this.socket.disconnect();
  }
}
