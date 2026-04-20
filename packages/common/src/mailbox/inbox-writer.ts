/**
 * Writes inbox messages to bot JSONL mailbox files.
 * Uses O_EXCL-based file locking for concurrency safety.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import type { InboxMessage } from './types.js';
import { loadSurfaceMap, type SurfaceMap } from './surface-map.js';

const LOCK_TIMEOUT_MS = 5_000;

export class InboxWriter {
  private readonly mailboxDir: string;
  private readonly surfaceMap: SurfaceMap;

  constructor(mailboxDir: string) {
    this.mailboxDir = mailboxDir;
    this.surfaceMap = loadSurfaceMap();
  }

  getSurfaceMap(): SurfaceMap {
    return this.surfaceMap;
  }

  /** Write a message to a bot's inbox and nudge the bot to process it */
  async write(botId: string, msg: Omit<InboxMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMsg: InboxMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const inboxPath = path.join(this.mailboxDir, botId, 'inbox.jsonl');
    const lockPath = inboxPath + '.lock';

    // Ensure directory exists
    fs.mkdirSync(path.join(this.mailboxDir, botId, 'archive'), { recursive: true });
    if (!fs.existsSync(inboxPath)) fs.writeFileSync(inboxPath, '');

    // Acquire lock
    await this.acquireLock(lockPath);
    try {
      fs.appendFileSync(inboxPath, JSON.stringify(fullMsg) + '\n');
    } finally {
      this.releaseLock(lockPath);
    }

    // Nudge the bot's Claude Code session to call check_inbox
    this.nudgeBot(botId);

    return fullMsg.id;
  }

  /** Send a prompt to the bot's Claude Code session via cmux */
  private nudgeBot(botId: string): void {
    const surface = this.surfaceMap.surfaces[botId];
    if (!surface) {
      console.log(`[nudge] ${botId}: no surface mapping — skipping`);
      return;
    }

    const cmd = `cmux send --workspace "${this.surfaceMap.workspace}" --surface "${surface}" "check_inbox\\n"`;
    console.log(`[nudge] ${botId}: ${cmd}`);

    exec(cmd, { timeout: 5_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[nudge] ${botId} FAILED: ${stderr || err.message}`);
      } else {
        console.log(`[nudge] ${botId}: OK`);
      }
    });
  }

  private async acquireLock(lockPath: string): Promise<void> {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 30));
      }
    }
    // Timeout — force acquire (stale lock)
    fs.writeFileSync(lockPath, String(process.pid));
  }

  private releaseLock(lockPath: string): void {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore
    }
  }
}
