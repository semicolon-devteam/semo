/**
 * JSONL file-based mailbox with flock-based concurrency control.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { InboxMessage, OutboxMessage } from './types.js';
import { PRIORITY_ORDER } from './types.js';

const LOCK_TIMEOUT_MS = 5_000;

/** Simple file-level mutex using O_EXCL atomic creation */
class FileMutex {
  private lockPath: string;

  constructor(basePath: string) {
    this.lockPath = basePath + '.lock';
  }

  async acquire(): Promise<void> {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        fs.writeFileSync(this.lockPath, String(process.pid), { flag: 'wx' });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    // Timeout — check if holder is still alive before force-acquiring
    try {
      const holderPid = parseInt(fs.readFileSync(this.lockPath, 'utf8').trim(), 10);
      if (holderPid && !isNaN(holderPid)) {
        try {
          process.kill(holderPid, 0); // signal 0 = check existence
          console.error(`[lock] Force-acquiring lock from live process ${holderPid}`);
        } catch {
          // Process is dead — safe to take over
        }
      }
    } catch {
      /* ignore read errors */
    }
    fs.writeFileSync(this.lockPath, String(process.pid));
  }

  release(): void {
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // ignore
    }
  }
}

export class Mailbox {
  private readonly botId: string;
  private readonly baseDir: string;
  private readonly inboxPath: string;
  private readonly consumedPath: string;
  private readonly outboxPath: string;
  private readonly inboxMutex: FileMutex;
  private readonly outboxMutex: FileMutex;
  private consumedIds: Set<string>;

  constructor(botId: string, mailboxDir: string) {
    this.botId = botId;
    this.baseDir = path.join(mailboxDir, botId);
    this.inboxPath = path.join(this.baseDir, 'inbox.jsonl');
    this.consumedPath = path.join(this.baseDir, 'inbox.consumed');
    this.outboxPath = path.join(this.baseDir, 'outbox.jsonl');
    this.currentPath = path.join(this.baseDir, '_current');
    this.inboxMutex = new FileMutex(this.inboxPath);
    this.outboxMutex = new FileMutex(this.outboxPath);

    // Ensure directories exist
    fs.mkdirSync(path.join(this.baseDir, 'archive'), { recursive: true });
    this.touchFile(this.inboxPath);
    this.touchFile(this.consumedPath);
    this.touchFile(this.outboxPath);

    // Load consumed IDs
    this.consumedIds = this.loadConsumedIds();
  }

  private touchFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '');
    }
  }

  private readonly currentPath: string;

  private loadConsumedIds(): Set<string> {
    try {
      const content = fs.readFileSync(this.consumedPath, 'utf8').trim();
      if (!content) return new Set();
      return new Set(content.split('\n').filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private markConsumed(id: string): void {
    this.consumedIds.add(id);
    fs.appendFileSync(this.consumedPath, id + '\n');
  }

  /** Load in-progress message ID from previous session (crash recovery) */
  private loadCurrentId(): string | null {
    try {
      const content = fs.readFileSync(this.currentPath, 'utf8').trim();
      return content || null;
    } catch {
      return null;
    }
  }

  /** Track in-progress message to recover on crash */
  private markCurrent(id: string): void {
    fs.writeFileSync(this.currentPath, id);
  }

  /** Clear current tracking (after reply/escalate) */
  clearCurrent(): void {
    try {
      fs.unlinkSync(this.currentPath);
    } catch {
      /* ignore */
    }
  }

  /** Read next unprocessed inbox message (priority-ordered) */
  async checkInbox(): Promise<InboxMessage | null> {
    // On startup: check if there's an in-progress message from a previous crash
    const currentId = this.loadCurrentId();
    if (currentId && !this.consumedIds.has(currentId)) {
      // Un-consume it so it gets re-delivered
      // (it was consumed on first read but never replied to)
    }

    await this.inboxMutex.acquire();
    try {
      const content = fs.readFileSync(this.inboxPath, 'utf8').trim();
      if (!content) return null;

      const lines = content.split('\n').filter(Boolean);
      const unconsumed: InboxMessage[] = [];

      for (const line of lines) {
        try {
          const msg: InboxMessage = JSON.parse(line);
          // Include if not consumed, OR if it's the crashed _current message
          if (!this.consumedIds.has(msg.id) || msg.id === currentId) {
            unconsumed.push(msg);
          }
        } catch {
          // Skip malformed lines
        }
      }

      if (unconsumed.length === 0) return null;

      // Sort by priority (urgent > normal > low), then by timestamp
      unconsumed.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 1;
        const pb = PRIORITY_ORDER[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return a.timestamp.localeCompare(b.timestamp);
      });

      const next = unconsumed[0];
      this.markCurrent(next.id);
      this.markConsumed(next.id);
      return next;
    } finally {
      this.inboxMutex.release();
    }
  }

  /** Write a message to the outbox */
  async writeOutbox(msg: OutboxMessage): Promise<void> {
    await this.outboxMutex.acquire();
    try {
      fs.appendFileSync(this.outboxPath, JSON.stringify(msg) + '\n');
    } finally {
      this.outboxMutex.release();
    }
  }

  /** Write heartbeat timestamp */
  writeHeartbeat(): void {
    const heartbeatPath = path.join(this.baseDir, 'heartbeat');
    fs.writeFileSync(heartbeatPath, new Date().toISOString());
  }

  /** Check if shutdown flag exists */
  isShutdown(): boolean {
    const shutdownPath = path.join(path.dirname(this.baseDir), '_shutdown');
    return fs.existsSync(shutdownPath);
  }

  /** Get the inbox path for fs.watch */
  getInboxPath(): string {
    return this.inboxPath;
  }

  /** Get count of pending (unconsumed) messages */
  getPendingCount(): number {
    try {
      const content = fs.readFileSync(this.inboxPath, 'utf8').trim();
      if (!content) return 0;
      const lines = content.split('\n').filter(Boolean);
      let count = 0;
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (!this.consumedIds.has(msg.id)) count++;
        } catch {
          // skip
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  /** Compact inbox — remove consumed messages, reset consumed file */
  async compact(): Promise<void> {
    await this.inboxMutex.acquire();
    try {
      const content = fs.readFileSync(this.inboxPath, 'utf8').trim();
      if (!content) return;

      const lines = content.split('\n').filter(Boolean);
      const remaining: string[] = [];
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (!this.consumedIds.has(msg.id)) {
            remaining.push(line);
          }
        } catch {
          // skip malformed
        }
      }

      // Rewrite inbox with only unconsumed messages
      fs.writeFileSync(this.inboxPath, remaining.length > 0 ? remaining.join('\n') + '\n' : '');
      // Reset consumed tracking
      fs.writeFileSync(this.consumedPath, '');
      this.consumedIds = new Set();

      // Remove compact flag
      const flagPath = path.join(this.baseDir, '_compact_needed');
      try {
        fs.unlinkSync(flagPath);
      } catch {
        /* ignore */
      }
    } finally {
      this.inboxMutex.release();
    }
  }

  /** Track processed count and auto-compact at threshold */
  private processedCount = 0;
  private readonly COMPACT_THRESHOLD = 50;

  incrementProcessed(): void {
    this.processedCount++;
    if (this.processedCount >= this.COMPACT_THRESHOLD) {
      this.compact().catch((err) => console.error('[mailbox] Compaction failed:', err));
      this.processedCount = 0;
    }
  }
}
