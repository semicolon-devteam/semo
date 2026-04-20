/**
 * Monitors bot session health via heartbeat files.
 * Restarts dead sessions via cmux send to the bot's surface (from SEMO_SURFACE_MAP).
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadSurfaceMap, type SurfaceMap } from '../mailbox/surface-map.js';

const execAsync = promisify(exec);

const HEARTBEAT_STALE_MS = 120_000; // 2 minutes
const CHECK_INTERVAL_MS = 30_000;
const INITIAL_GRACE_MS = 60_000;
const LOG_REPEAT_MS = 10 * 60_000; // re-log same-state warning every 10 min

type BotState = 'ok' | 'stale' | 'no-heartbeat' | 'no-surface' | 'restart-sent';

export class HealthMonitor {
  private readonly mailboxDir: string;
  private readonly botIds: string[];
  private readonly sessionDir: string;
  private readonly surfaceMap: SurfaceMap;
  private readonly onRestart?: (botId: string) => Promise<void>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  /** Re-entrancy guard: skip next tick if previous check() still running */
  private checkRunning = false;
  /** Per-bot restart-in-flight guard: prevent overlapping /quit+start on same bot */
  private readonly restarting: Set<string> = new Set();
  /** Dedup key: `${botId}:${state}` → last-logged timestamp */
  private readonly lastLog: Map<string, number> = new Map();
  /** Per-bot worst-known state (for recovery message) */
  private readonly lastState: Map<string, BotState> = new Map();

  constructor(opts: {
    mailboxDir: string;
    botIds: string[];
    sessionDir: string;
    surfaceMap?: SurfaceMap;
    onRestart?: (botId: string) => Promise<void>;
  }) {
    this.mailboxDir = opts.mailboxDir;
    this.botIds = opts.botIds;
    this.sessionDir = opts.sessionDir;
    this.surfaceMap = opts.surfaceMap ?? loadSurfaceMap();
    this.onRestart = opts.onRestart;
  }

  start(): void {
    this.initialTimer = setTimeout(() => {
      this.check();
      this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    }, INITIAL_GRACE_MS);
  }

  private shouldLog(botId: string, state: BotState): boolean {
    const key = `${botId}:${state}`;
    const prev = this.lastLog.get(key);
    const now = Date.now();
    if (prev === undefined || now - prev > LOG_REPEAT_MS) {
      this.lastLog.set(key, now);
      this.lastState.set(botId, state);
      return true;
    }
    this.lastState.set(botId, state);
    return false;
  }

  private clearLog(botId: string): void {
    const prev = this.lastState.get(botId);
    if (prev && prev !== 'ok') {
      console.log(`[health] ${botId}: heartbeat recovered`);
      // Purge dedup so next warning logs immediately
      for (const key of this.lastLog.keys()) {
        if (key.startsWith(`${botId}:`)) this.lastLog.delete(key);
      }
    }
    this.lastState.set(botId, 'ok');
  }

  private async check(): Promise<void> {
    if (this.checkRunning) return;
    this.checkRunning = true;
    try {
      for (const botId of this.botIds) {
        const heartbeatPath = path.join(this.mailboxDir, botId, 'heartbeat');
        let stale = false;
        let staleSec = 0;
        try {
          const content = fs.readFileSync(heartbeatPath, 'utf8').trim();
          const lastBeat = new Date(content).getTime();
          if (isNaN(lastBeat)) {
            if (this.shouldLog(botId, 'no-heartbeat')) {
              console.error(`[health] ${botId}: invalid heartbeat content`);
            }
            continue;
          }
          staleSec = Math.round((Date.now() - lastBeat) / 1000);
          stale = Date.now() - lastBeat > HEARTBEAT_STALE_MS;
        } catch {
          if (this.shouldLog(botId, 'no-heartbeat')) {
            console.error(`[health] ${botId}: no heartbeat file — attempting restart`);
          }
          await this.restartBot(botId);
          continue;
        }

        if (stale) {
          if (this.shouldLog(botId, 'stale')) {
            console.error(`[health] ${botId}: heartbeat stale (${staleSec}s) — attempting restart`);
          }
          await this.restartBot(botId);
        } else {
          this.clearLog(botId);
        }
      }
    } finally {
      this.checkRunning = false;
    }
  }

  private async restartBot(botId: string): Promise<void> {
    if (!/^[a-z0-9-]+$/.test(botId)) {
      console.error(`[health] ${botId}: invalid botId format — skipping restart`);
      return;
    }
    if (this.restarting.has(botId)) return;
    this.restarting.add(botId);
    try {
      const surface = this.surfaceMap.surfaces[botId];
      if (!surface) {
        if (this.shouldLog(botId, 'no-surface')) {
          console.log(
            `[health] ${botId}: no surface in SEMO_SURFACE_MAP — skipping restart (manual mode)`,
          );
        }
        return;
      }

      const workspace = this.surfaceMap.workspace;
      const sessionPath = path.join(this.sessionDir, botId);
      const startCmd = `cd ${sessionPath} && claude --permission-mode dontAsk`;

      try {
        // /quit the existing session (ignore failure — surface might be at shell already)
        await execAsync(`cmux send --workspace "${workspace}" --surface "${surface}" '/quit'`, {
          timeout: 5_000,
        }).catch(() => {});
        await execAsync(`cmux send --workspace "${workspace}" --surface "${surface}" $'\\n'`, {
          timeout: 5_000,
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2_000));

        // Start fresh claude session
        await execAsync(
          `cmux send --workspace "${workspace}" --surface "${surface}" ${JSON.stringify(startCmd)}`,
          { timeout: 5_000 },
        );
        await execAsync(`cmux send --workspace "${workspace}" --surface "${surface}" $'\\n'`, {
          timeout: 5_000,
        });
        if (this.shouldLog(botId, 'restart-sent')) {
          console.log(`[health] ${botId}: restart sent to ${workspace}/${surface}`);
        }
      } catch (err) {
        console.error(`[health] ${botId}: cmux restart failed:`, (err as Error).message);
        return;
      }

      if (this.onRestart) {
        await this.onRestart(botId).catch(() => {});
      }
    } finally {
      this.restarting.delete(botId);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
  }
}
