/**
 * Monitors bot session health via heartbeat files.
 * Restarts dead sessions via cmux respawn-pane.
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const HEARTBEAT_STALE_MS = 120_000; // 2 minutes
const CHECK_INTERVAL_MS = 30_000;

export class HealthMonitor {
  private readonly mailboxDir: string;
  private readonly botIds: string[];
  private readonly botPaneIndex: Record<string, number>;
  private readonly sessionDir: string;
  private readonly onRestart?: (botId: string) => Promise<void>;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: {
    mailboxDir: string;
    botIds: string[];
    sessionDir: string;
    onRestart?: (botId: string) => Promise<void>;
  }) {
    this.mailboxDir = opts.mailboxDir;
    this.botIds = opts.botIds;
    this.sessionDir = opts.sessionDir;
    this.onRestart = opts.onRestart;

    // Pane index: bot index + 1 (pane 0 = router)
    this.botPaneIndex = {};
    opts.botIds.forEach((id, i) => {
      this.botPaneIndex[id] = i + 1;
    });
  }

  start(): void {
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    // Initial check after 60s (give bots time to start)
    setTimeout(() => this.check(), 60_000);
  }

  private async check(): Promise<void> {
    for (const botId of this.botIds) {
      const heartbeatPath = path.join(this.mailboxDir, botId, 'heartbeat');
      try {
        const content = fs.readFileSync(heartbeatPath, 'utf8').trim();
        const lastBeat = new Date(content).getTime();
        if (isNaN(lastBeat)) {
          console.error(`[health] ${botId}: invalid heartbeat content`);
          continue;
        }
        if (Date.now() - lastBeat > HEARTBEAT_STALE_MS) {
          console.error(
            `[health] ${botId}: heartbeat stale (${Math.round((Date.now() - lastBeat) / 1000)}s) — restarting`,
          );
          await this.restartBot(botId);
        }
      } catch {
        // No heartbeat file — bot never started or crashed hard
        console.error(`[health] ${botId}: no heartbeat file — restarting`);
        await this.restartBot(botId);
      }
    }
  }

  private async restartBot(botId: string): Promise<void> {
    const workspace = process.env.SEMO_WORKSPACE || 'semo-agents';

    // Skip restart if workspace doesn't exist (test/manual mode)
    try {
      await execAsync(`cmux list-workspaces 2>/dev/null | grep -q "${workspace}"`, {
        timeout: 3_000,
      });
    } catch {
      console.log(
        `[health] ${botId}: workspace "${workspace}" not found — skipping restart (manual mode)`,
      );
      return;
    }

    const sessionPath = path.join(this.sessionDir, botId);
    const cmd = `cd ${sessionPath} && claude --permission-mode dontAsk`;

    try {
      const pane = `pane:${this.botPaneIndex[botId]}`;
      await execAsync(
        `cmux send --workspace "${workspace}" --surface "${pane}" "/quit\\n" 2>/dev/null || true`,
        { timeout: 5_000 },
      );
      await new Promise((r) => setTimeout(r, 2_000));
      await execAsync(`cmux send --workspace "${workspace}" --surface "${pane}" "${cmd}\\n"`, {
        timeout: 5_000,
      });
      console.log(`[health] ${botId}: restarted via cmux`);
    } catch (err) {
      console.error(`[health] ${botId}: cmux restart failed:`, err);
    }

    if (this.onRestart) {
      await this.onRestart(botId).catch(() => {});
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
