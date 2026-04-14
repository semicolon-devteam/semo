/**
 * Writes inbox messages to bot JSONL mailbox files.
 * Uses O_EXCL-based file locking for concurrency safety.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import type { InboxMessage } from '../../agent-mailbox/src/types.js';

const LOCK_TIMEOUT_MS = 5_000;

/** Load surface mapping from file or use default pane indices */
function loadSurfaceMap(): { workspace: string; surfaces: Record<string, string> } {
  const mapPath = process.env.SEMO_SURFACE_MAP || '/tmp/semo-surface-map.json';
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    // Fallback: standard pane indices (for semo-agents-start.sh workspace)
    const workspace = process.env.SEMO_WORKSPACE || 'semo-agents';
    return {
      workspace,
      surfaces: {
        semiclaw: 'pane:1',
        planclaw: 'pane:2',
        designclaw: 'pane:3',
        workclaw: 'pane:4',
        reviewclaw: 'pane:5',
        infraclaw: 'pane:6',
        growthclaw: 'pane:7',
      },
    };
  }
}

export class InboxWriter {
  private readonly mailboxDir: string;
  private readonly surfaceMap: { workspace: string; surfaces: Record<string, string> };

  constructor(mailboxDir: string) {
    this.mailboxDir = mailboxDir;
    this.surfaceMap = loadSurfaceMap();
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
