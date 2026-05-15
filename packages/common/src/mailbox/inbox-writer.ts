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
const SURFACE_MAP_RELOAD_DEBOUNCE_MS = 200;

export class InboxWriter {
  private readonly mailboxDir: string;
  private surfaceMap: SurfaceMap;
  private readonly surfaceMapPath: string;
  private surfaceMapWatcher: fs.FSWatcher | null = null;
  private surfaceMapDirWatcher: fs.FSWatcher | null = null;
  private surfaceMapReloadTimer: NodeJS.Timeout | null = null;

  constructor(mailboxDir: string) {
    this.mailboxDir = mailboxDir;
    this.surfaceMapPath = process.env.SEMO_SURFACE_MAP || '/tmp/semo-surface-map.json';
    this.surfaceMap = loadSurfaceMap();
    this.startSurfaceMapWatch();
  }

  getSurfaceMap(): SurfaceMap {
    return this.surfaceMap;
  }

  /** stop fs.watch (test/teardown) */
  stop(): void {
    this.surfaceMapWatcher?.close();
    this.surfaceMapWatcher = null;
    this.surfaceMapDirWatcher?.close();
    this.surfaceMapDirWatcher = null;
    if (this.surfaceMapReloadTimer) {
      clearTimeout(this.surfaceMapReloadTimer);
      this.surfaceMapReloadTimer = null;
    }
  }

  /**
   * Watch surface-map.json for changes and reload on update. Handles the case
   * where the file doesn't exist yet at boot (router started before
   * semo-agents-start.sh wrote the map): we fall back to dir-watch and switch
   * to file-watch once the file appears.
   *
   * 2026-05-09: Added after race condition incident
   * (semo incident/inbox-writer-stale-surface-map-2026-05-09).
   */
  private startSurfaceMapWatch(): void {
    const scheduleReload = (reason: string) => {
      if (this.surfaceMapReloadTimer) clearTimeout(this.surfaceMapReloadTimer);
      this.surfaceMapReloadTimer = setTimeout(() => {
        this.surfaceMapReloadTimer = null;
        try {
          const fresh = loadSurfaceMap();
          this.surfaceMap = fresh;
          const surfaceCount = Object.keys(fresh.surfaces).length;
          console.log(
            `[inbox-writer] surface map reloaded (${reason}): workspace=${fresh.workspace} surfaces=${surfaceCount}`,
          );
        } catch (err) {
          console.warn(`[inbox-writer] surface map reload failed: ${(err as Error).message}`);
        }
      }, SURFACE_MAP_RELOAD_DEBOUNCE_MS);
    };

    const tryWatchFile = () => {
      try {
        this.surfaceMapWatcher = fs.watch(
          this.surfaceMapPath,
          { persistent: false },
          (eventType) => {
            scheduleReload(`file ${eventType}`);
          },
        );
        console.log(`[inbox-writer] watching surface map: ${this.surfaceMapPath}`);
      } catch {
        // File may not exist yet — fall back to dir-watch.
        const dir = path.dirname(this.surfaceMapPath);
        const base = path.basename(this.surfaceMapPath);
        try {
          this.surfaceMapDirWatcher = fs.watch(dir, { persistent: false }, (_evt, filename) => {
            if (filename !== base) return;
            // File appeared — promote to file-watch.
            this.surfaceMapDirWatcher?.close();
            this.surfaceMapDirWatcher = null;
            scheduleReload('file appeared');
            tryWatchFile();
          });
          console.log(
            `[inbox-writer] surface map ${this.surfaceMapPath} not found — watching dir for creation`,
          );
        } catch (err) {
          console.warn(
            `[inbox-writer] failed to watch surface map dir: ${(err as Error).message}`,
          );
        }
      }
    };

    tryWatchFile();
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
    console.log(`[nudge] ${botId} (best-effort): ${cmd}`);

    exec(cmd, { timeout: 5_000 }, (err, stdout, stderr) => {
      if (err) {
        // Nudge failure is non-fatal — inbox.jsonl append is the SoT.
        // Bot will pick up the message via:
        //   1) MCP fs.watch notification (agent-mailbox watchInbox),
        //   2) 3s MCP polling fallback,
        //   3) Stop hook inbox-drain-prompt (drain on next session idle).
        // See: semo decision/router-cmux-nudge-persistence (2026-05-01).
        console.warn(
          `[nudge] ${botId}: cmux delivery failed (non-fatal): ${stderr || err.message}`,
        );
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
