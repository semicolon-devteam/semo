/**
 * Polls bot outbox files and processes messages (post via gateway, handle escalations).
 * Platform-agnostic: uses GatewayAdapter interface instead of direct Slack dependency.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { OutboxMessage } from './types.js';
import type { InboxWriter } from './inbox-writer.js';

const POLL_INTERVAL_MS = 500;

/** Platform-agnostic gateway interface for posting messages */
export interface GatewayAdapter {
  postAsBot(botId: string, channel: string, text: string, threadTs?: string): Promise<void>;
  setTypingStatus(channel: string, threadTs: string, status: string): Promise<void>;
  addReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
}

export class OutboxReader {
  private readonly mailboxDir: string;
  private readonly botIds: string[];
  private readonly platform: 'slack' | 'discord';
  private readonly gateway: GatewayAdapter;
  private readonly inboxWriter: InboxWriter;
  private readonly onEscalation: (msg: OutboxMessage) => Promise<void>;
  private readonly onAskUser: (msg: OutboxMessage) => Promise<void>;
  /** Track byte offset per bot to only read new content */
  private fileOffsets = new Map<string, number>();
  /** Prevent concurrent processOutbox for same bot */
  private processing = new Set<string>();
  private watchers: fs.FSWatcher[] = [];

  constructor(opts: {
    mailboxDir: string;
    botIds: string[];
    platform: 'slack' | 'discord';
    gateway: GatewayAdapter;
    inboxWriter: InboxWriter;
    onEscalation: (msg: OutboxMessage) => Promise<void>;
    onAskUser: (msg: OutboxMessage) => Promise<void>;
  }) {
    this.mailboxDir = opts.mailboxDir;
    this.botIds = opts.botIds;
    this.platform = opts.platform;
    this.gateway = opts.gateway;
    this.inboxWriter = opts.inboxWriter;
    this.onEscalation = opts.onEscalation;
    this.onAskUser = opts.onAskUser;
  }

  start(): void {
    // fs.watch on each bot's outbox
    for (const botId of this.botIds) {
      const outboxPath = path.join(this.mailboxDir, botId, 'outbox.jsonl');
      this.ensureFile(outboxPath);
      // Skip existing content on startup — only process new messages
      try {
        const skipBytes = fs.statSync(outboxPath).size;
        if (skipBytes > 0) {
          console.log(`[outbox] ${botId}: skipping ${skipBytes} existing bytes on startup`);
        }
        this.fileOffsets.set(botId, skipBytes);
      } catch {
        /* ignore */
      }
      try {
        const watcher = fs.watch(outboxPath, { persistent: false }, () => {
          this.processOutbox(botId).catch((err) =>
            console.error(`[outbox] Error processing ${botId}:`, err),
          );
        });
        this.watchers.push(watcher);
      } catch {
        console.error(`[outbox] fs.watch failed for ${botId}`);
      }
    }

    // Fallback poll
    setInterval(() => {
      for (const botId of this.botIds) {
        this.processOutbox(botId).catch(() => {});
      }
    }, POLL_INTERVAL_MS);
  }

  private ensureFile(filePath: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
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
      this.fileOffsets.set(botId, 0);
      return;
    }

    // No new content
    if (fileSize === offset) return;

    console.log(
      `[outbox] ${botId}: new data detected (${fileSize - offset} bytes from offset ${offset})`,
    );

    // Advance offset BEFORE reading to prevent duplicate processing
    this.fileOffsets.set(botId, fileSize);

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
          try {
            console.log(
              `[outbox] Posting reply from ${msg.bot_id}: "${msg.text.slice(0, 30)}" (id: ${msg.id?.slice(0, 8)})`,
            );
            await this.gateway.postAsBot(msg.bot_id, msg.channel_id, msg.text, msg.thread_id);
            console.log(`[outbox] Posted reply from ${msg.bot_id} to ${this.platform}`);
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
  }
}
