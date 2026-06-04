/**
 * Polls bot outbox files and processes messages (post via gateway, handle escalations).
 * Platform-agnostic: uses GatewayAdapter interface instead of direct Slack dependency.
 *
 * P5-2d: ProjectionEmitter 도 옵션으로 받음. 우선순위 = projection > gateway.
 * 회귀 0 보장 — projection 미주입 시 gateway 그대로 사용.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { OutboxMessage } from './types.js';
import type { InboxWriter } from './inbox-writer.js';
import type { ProjectionChannel, ProjectionEmitter } from '../runtime/projection-emitter.js';
import { isUsageRejection } from './usage-rejection.js';

const POLL_INTERVAL_MS = 500;
/** Per-bot throttle for usage-rejection alerts: at most one alert per hour per bot. */
const USAGE_REJECTION_NOTIFY_INTERVAL_MS = 60 * 60_000;

/** Platform-agnostic gateway interface for posting messages */
export interface GatewayAdapter {
  postAsBot(botId: string, channel: string, text: string, threadTs?: string): Promise<void>;
  setTypingStatus(channel: string, threadTs: string, status: string): Promise<void>;
  addReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
}

export class OutboxReader {
  private readonly mailboxDir: string;
  private botIds: string[];
  private readonly platform: 'slack' | 'discord';
  private readonly gateway: GatewayAdapter;
  /** P5-2d: optional projection emitter — 주입 시 reply 흐름이 emitter 로 분기. */
  private readonly projection?: ProjectionEmitter;
  private readonly inboxWriter: InboxWriter;
  private readonly onEscalation: (msg: OutboxMessage) => Promise<void>;
  private readonly onAskUser: (msg: OutboxMessage) => Promise<void>;
  private readonly onReplyPosted?: (msg: OutboxMessage) => Promise<void>;
  /**
   * Fired (throttled) when a bot's reply text matches a Claude Code usage-rejection
   * pattern. Router decides how to surface it (Slack #bot-ops, console, etc.).
   */
  private readonly onUsageRejection?: (botId: string, text: string) => Promise<void>;
  /**
   * Optional reply transform — called BEFORE posting a reply. Used by router to
   * implement persona wrapping (e.g., post as Semi orchestrator with footer
   * "executed by reviewclaw" instead of as reviewclaw directly).
   * Returns null to keep the original (botId, text); returns object to override.
   * KB: semo decision/semi-slack-router-integration-complete-2026-05-27
   */
  private readonly replyTransform?: (
    msg: OutboxMessage,
  ) => Promise<{ botId: string; text: string } | null>;
  /** Track byte offset per bot to only read new content */
  private fileOffsets = new Map<string, number>();
  /** Prevent concurrent processOutbox for same bot */
  private processing = new Set<string>();
  private watchers: fs.FSWatcher[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Per-bot last usage-rejection alert epoch ms (throttle). */
  private usageRejectionNotifiedAt = new Map<string, number>();

  constructor(opts: {
    mailboxDir: string;
    botIds: string[];
    platform: 'slack' | 'discord';
    gateway: GatewayAdapter;
    /** P5-2d: optional ProjectionEmitter — 주입 시 reply 처리에 우선 사용. */
    projection?: ProjectionEmitter;
    inboxWriter: InboxWriter;
    onEscalation: (msg: OutboxMessage) => Promise<void>;
    onAskUser: (msg: OutboxMessage) => Promise<void>;
    /** Fired after a successful `reply` post — used by router to mark commitments done */
    onReplyPosted?: (msg: OutboxMessage) => Promise<void>;
    /**
     * Fired when an outgoing reply is blocked because its text matches a Claude Code
     * usage-rejection pattern (extra usage exhausted, LLM request rejected, etc.).
     * Throttled per-bot to avoid #bot-ops spam.
     */
    onUsageRejection?: (botId: string, text: string) => Promise<void>;
    /** Optional persona wrapping — see field doc above. */
    replyTransform?: (msg: OutboxMessage) => Promise<{ botId: string; text: string } | null>;
  }) {
    this.mailboxDir = opts.mailboxDir;
    this.botIds = opts.botIds;
    this.platform = opts.platform;
    this.gateway = opts.gateway;
    this.projection = opts.projection;
    this.inboxWriter = opts.inboxWriter;
    this.onEscalation = opts.onEscalation;
    this.onAskUser = opts.onAskUser;
    this.onReplyPosted = opts.onReplyPosted;
    this.onUsageRejection = opts.onUsageRejection;
    this.replyTransform = opts.replyTransform;
  }

  start(): void {
    // fs.watch on each bot's outbox
    for (const botId of this.botIds) {
      this.watchBot(botId);
    }

    // Fallback poll
    this.pollTimer = setInterval(() => {
      for (const botId of this.botIds) {
        this.processOutbox(botId).catch(() => {});
      }
    }, POLL_INTERVAL_MS);
  }

  /** Set up fs.watch + offset for one bot's outbox (skip existing content). */
  private watchBot(botId: string): void {
    const outboxPath = path.join(this.mailboxDir, botId, 'outbox.jsonl');
    this.ensureFile(outboxPath);
    try {
      const fileSize = fs.statSync(outboxPath).size;
      // 영속 offset 이 있고 파일 크기 이하면 그 지점부터 재개(재기동 다운타임 유실 방지).
      // 없거나(최초 기동) 파일이 그보다 작아졌으면(rotation) 보수적으로 기존 바이트 skip(double-post 방지).
      const persisted = this.loadOffset(botId);
      const startOffset = persisted != null && persisted <= fileSize ? persisted : fileSize;
      if (startOffset < fileSize) {
        console.log(
          `[outbox] ${botId}: resuming from persisted offset ${startOffset} (file ${fileSize}, ${fileSize - startOffset} bytes pending)`,
        );
      } else if (fileSize > 0) {
        console.log(`[outbox] ${botId}: skipping ${fileSize} existing bytes on startup`);
      }
      this.setOffset(botId, startOffset);
    } catch {
      /* ignore */
    }
    try {
      const watcher = fs.watch(outboxPath, { persistent: false }, () => {
        this.processOutbox(botId).catch((err) =>
          console.error(`[outbox] Error processing ${botId}:`, err),
        );
      });
      watcher.on('error', (err) => {
        console.warn(`[outbox] fs.watch error for ${botId}: ${(err as Error).message}`);
      });
      this.watchers.push(watcher);
    } catch {
      console.error(`[outbox] fs.watch failed for ${botId}`);
    }
  }

  /**
   * 런타임에 watch 대상 봇 추가 (동적 customer 에이전트용). 이미 있는 봇은 무시.
   * @returns 실제로 추가된 botId 들.
   */
  addBots(newIds: string[]): string[] {
    const added: string[] = [];
    for (const botId of newIds) {
      if (this.botIds.includes(botId)) continue;
      this.botIds.push(botId);
      if (this.pollTimer) this.watchBot(botId); // start() 이후면 즉시 watch
      added.push(botId);
    }
    return added;
  }

  private ensureFile(filePath: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
  }

  private offsetFilePath(botId: string): string {
    return path.join(this.mailboxDir, botId, '.outbox-offset');
  }

  /**
   * 읽기 offset 을 메모리 + 디스크에 기록(재기동 내구성).
   * 영속 offset 이 있어야 slack-router 재기동 시 다운타임 중 append 된 reply 를
   * skip(유실)하지 않고 그 지점부터 재개한다. offset 은 항상 'dispatch 시작한 지점'까지만
   * 전진하므로(at-most-once, line 197) 재기동 후 double-post 는 발생하지 않는다.
   */
  private setOffset(botId: string, offset: number): void {
    this.fileOffsets.set(botId, offset);
    try {
      fs.writeFileSync(this.offsetFilePath(botId), String(offset));
    } catch {
      /* best-effort — 실패해도 메모리 offset 으로 동작(재기동 내구성만 저하) */
    }
  }

  /** 영속 offset 로드. 파일 없음/파싱 실패면 null. */
  private loadOffset(botId: string): number | null {
    try {
      const raw = fs.readFileSync(this.offsetFilePath(botId), 'utf8').trim();
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    } catch {
      return null;
    }
  }

  private async processOutbox(botId: string): Promise<void> {
    // Prevent concurrent processing for same bot
    if (this.processing.has(botId)) return;
    this.processing.add(botId);

    try {
      await this._processOutboxInner(botId);
    } finally {
      this.processing.delete(botId);
    }
  }

  private async _processOutboxInner(botId: string): Promise<void> {
    const outboxPath = path.join(this.mailboxDir, botId, 'outbox.jsonl');

    // Get file size
    let fileSize: number;
    try {
      fileSize = fs.statSync(outboxPath).size;
    } catch {
      return;
    }

    const offset = this.fileOffsets.get(botId) || 0;

    // File was truncated/rotated — reset offset
    if (fileSize < offset) {
      this.setOffset(botId, 0);
      return;
    }

    // No new content
    if (fileSize === offset) return;

    console.log(
      `[outbox] ${botId}: new data detected (${fileSize - offset} bytes from offset ${offset})`,
    );

    // Advance offset BEFORE reading to prevent duplicate processing (+ 디스크 영속 → 재기동 내구성)
    this.setOffset(botId, fileSize);

    // Read only the new bytes
    const fd = fs.openSync(outboxPath, 'r');
    try {
      const buf = Buffer.alloc(fileSize - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      const newContent = buf.toString('utf8').trim();
      if (!newContent) return;

      const lines = newContent.split('\n').filter(Boolean);
      for (const line of lines) {
        let msg: OutboxMessage;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }

        try {
          await this.handleOutboxMessage(msg, botId);
        } catch (err) {
          console.error(`[outbox] Failed to handle ${msg.type} from ${botId}:`, err);
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  private async handleOutboxMessage(msg: OutboxMessage, botId: string): Promise<void> {
    // Skip messages from other platforms
    if (msg.platform && msg.platform !== this.platform) return;

    // Fallback: if channel_id is missing, look up from the inbox message it replies to
    if (!msg.channel_id && msg.in_reply_to) {
      const inboxContent = this.readInboxEntry(botId, msg.in_reply_to);
      if (inboxContent) {
        msg.channel_id = inboxContent.channel_id || '';
        msg.thread_id = msg.thread_id || inboxContent.thread_id || '';
      }
    }

    console.log(
      `[outbox] Processing: type=${msg.type} bot=${msg.bot_id} channel=${msg.channel_id}`,
    );
    switch (msg.type) {
      case 'reply':
        if (msg.text) {
          // Usage-rejection guard (2026-05-04 incident): if the reply text is a
          // Claude Code "out of extra usage" / "LLM request rejected" message,
          // do NOT post it to Slack/Discord. Instead, fire onUsageRejection at
          // most once per hour per bot so router can alert #bot-ops.
          if (isUsageRejection(msg.text)) {
            const last = this.usageRejectionNotifiedAt.get(msg.bot_id) ?? 0;
            const elapsed = Date.now() - last;
            const shouldNotify = elapsed >= USAGE_REJECTION_NOTIFY_INTERVAL_MS;
            console.warn(
              `[outbox] BLOCKED usage-rejection reply from ${msg.bot_id} ` +
                `(notify=${shouldNotify}, "${msg.text.slice(0, 80)}")`,
            );
            if (shouldNotify) {
              this.usageRejectionNotifiedAt.set(msg.bot_id, Date.now());
              if (this.onUsageRejection) {
                try {
                  await this.onUsageRejection(msg.bot_id, msg.text);
                } catch (err) {
                  console.error(
                    `[outbox] onUsageRejection callback failed for ${msg.bot_id}:`,
                    err,
                  );
                }
              }
            }
            // Skip posting + skip onReplyPosted (commitment will be reaped as stale_auto).
            break;
          }

          try {
            console.log(
              `[outbox] Posting reply from ${msg.bot_id}: "${msg.text.slice(0, 30)}" (id: ${msg.id?.slice(0, 8)})`,
            );
            let postBotId = msg.bot_id;
            let postText = msg.text;
            if (this.replyTransform) {
              try {
                const override = await this.replyTransform(msg);
                if (override) {
                  postBotId = override.botId;
                  postText = override.text;
                }
              } catch (err) {
                console.warn(
                  `[outbox] replyTransform failed for ${msg.bot_id}: ${(err as Error).message} — falling back to original persona`,
                );
              }
            }

            // P5-2d: projection emitter 주입 시 우선 사용, 실패/throw/미주입 시 gateway fallback.
            // (Codex 리뷰: projection.emit throw 가 outer catch 로 빠지면 fallback 미실행 → 별도 try)
            let posted = false;
            let postedVia: 'projection' | 'gateway' | `gateway(as ${string})` = 'gateway';
            if (this.projection) {
              const channel: ProjectionChannel =
                this.platform === 'slack' ? 'slack-block' : 'discord-embed';
              try {
                const result = await this.projection.emit(
                  {
                    channel,
                    destination: msg.channel_id,
                    options: { threadTs: msg.thread_id, botId: postBotId },
                  },
                  { text: postText },
                );
                if (result.ok) {
                  posted = true;
                  postedVia = 'projection';
                } else {
                  console.warn(
                    `[outbox] projection emit failed (${result.error}) — fallback to gateway`,
                  );
                }
              } catch (emitErr) {
                console.warn(
                  `[outbox] projection emit threw (${(emitErr as Error).message}) — fallback to gateway`,
                );
              }
            }
            if (!posted) {
              await this.gateway.postAsBot(postBotId, msg.channel_id, postText, msg.thread_id);
              postedVia = postBotId === msg.bot_id ? 'gateway' : `gateway(as ${postBotId})`;
            }
            console.log(
              `[outbox] Posted reply from ${msg.bot_id} to ${this.platform} via ${postedVia}`,
            );
            if (this.onReplyPosted) {
              try {
                await this.onReplyPosted(msg);
              } catch (err) {
                console.error(`[outbox] onReplyPosted hook failed for ${msg.bot_id}:`, err);
              }
            }
          } catch (err) {
            console.error(`[outbox] ${this.platform} post failed for ${msg.bot_id}:`, err);
          }
        }
        break;

      case 'status_update':
        if (msg.status_text) {
          await this.gateway.setTypingStatus(msg.channel_id, msg.thread_id, msg.status_text);
        }
        break;

      case 'react':
        if (msg.emoji && msg.message_id) {
          await this.gateway.addReaction(msg.channel_id, msg.message_id, msg.emoji);
        }
        break;

      case 'escalation':
        await this.onEscalation(msg);
        break;

      case 'ask_user':
        await this.onAskUser(msg);
        break;
    }
  }

  /** Look up an inbox message by ID to recover missing fields */
  private readInboxEntry(
    botId: string,
    messageId: string,
  ): { channel_id?: string; thread_id?: string } | null {
    try {
      const inboxPath = path.join(this.mailboxDir, botId, 'inbox.jsonl');
      const content = fs.readFileSync(inboxPath, 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === messageId) {
            return { channel_id: msg.channel_id, thread_id: msg.thread_id };
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* file not found */
    }
    return null;
  }

  stop(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
