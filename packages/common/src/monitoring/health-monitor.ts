/**
 * Monitors bot session health via heartbeat files.
 * Restarts dead sessions via cmux send to the bot's surface (from SEMO_SURFACE_MAP).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadSurfaceMap, type SurfaceMap } from '../mailbox/surface-map.js';

const execFileP = promisify(execFile);

const HEARTBEAT_STALE_MS = 120_000; // 2 minutes
const CHECK_INTERVAL_MS = 30_000;
const INITIAL_GRACE_MS = 60_000;
const LOG_REPEAT_MS = 10 * 60_000; // re-log same-state warning every 10 min
const FAILURE_LOG_REPEAT_MS = 60_000;
const DEFAULT_RESTART_COOLDOWN_MS = 10 * 60_000;

type BotState = 'ok' | 'stale' | 'no-heartbeat' | 'no-surface' | 'restart-sent';
// 'stuck' (2026-05-14): Claude Code 의 feedback modal / welcome 화면 / interactive picker 가
// prompt 영역 차지해 cmux send nudge 가 input 으로 흡수되는 상태. KB:
// semo incident/semobot-quota-and-modal-wake-failure-2026-05-14
type PaneState = 'idle' | 'busy' | 'dead' | 'stuck';

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
  /** Dedup key: `${botId}:${errorKind}` → last-logged timestamp */
  private readonly lastFailureLog: Map<string, number> = new Map();
  /** Per-bot worst-known state (for recovery message) */
  private readonly lastState: Map<string, BotState> = new Map();
  /** Per-bot auto-restart cooldown */
  private readonly lastRestartAt: Map<string, number> = new Map();

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

  private shouldLogFailure(botId: string, key: string): boolean {
    const dedupKey = `${botId}:${key}`;
    const prev = this.lastFailureLog.get(dedupKey);
    const now = Date.now();
    if (prev === undefined || now - prev > FAILURE_LOG_REPEAT_MS) {
      this.lastFailureLog.set(dedupKey, now);
      return true;
    }
    return false;
  }

  private autoRestartAllowed(botId: string): boolean {
    const raw = process.env.SEMO_HEALTH_AUTO_RESTART_BOTS ?? '';
    const allowed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return allowed.includes('*') || allowed.includes(botId);
  }

  private restartCooldownMs(): number {
    return Number(process.env.SEMO_HEALTH_RESTART_COOLDOWN_MS ?? DEFAULT_RESTART_COOLDOWN_MS);
  }

  private async readPaneState(workspace: string, surface: string): Promise<PaneState> {
    try {
      const { stdout } = await execFileP(
        'cmux',
        ['read-screen', '--workspace', workspace, '--surface', surface, '--lines', '30'],
        { timeout: 5_000 },
      );
      const isAlive = /bypass permissions|shift\+tab to cycle/.test(stdout);
      if (!isAlive) return 'dead';
      // 'stuck' — Claude Code modal/welcome 이 prompt 영역 차지. cmux send nudge 가
      // input 으로 흡수되어 봇 깨우지 못함 (incident semobot-quota-and-modal-wake-failure-2026-05-14).
      // Codex review: empirical 검증 결과 MCP notification surface 안 됨 →
      // OS-level signal 외 wake 불가. 1차 fix 는 'stuck' 인식만 (escalate 보고용).
      if (
        /How is Claude doing this session|1:\s*Bad\s+2:\s*Fine\s+3:\s*Good|Welcome back!|What's new/i.test(
          stdout,
        )
      ) {
        return 'stuck';
      }
      if (
        /esc to interrupt|Noodling|Sautéed for|Brewed for|Accomplishing|Fluttering|thinking|Sketching|Thundering|Simmering/i.test(
          stdout,
        )
      ) {
        return 'busy';
      }
      return 'idle';
    } catch {
      return 'busy';
    }
  }

  private hasRecentOutbox(botId: string): boolean {
    const outboxPath = path.join(this.mailboxDir, botId, 'outbox.jsonl');
    try {
      const st = fs.statSync(outboxPath);
      return Date.now() - st.mtimeMs < 60_000;
    } catch {
      return false;
    }
  }

  private acquireRestartLock(botId: string): string | null {
    const lockDir = path.join(os.homedir(), '.semo', 'state', 'health-monitor');
    fs.mkdirSync(lockDir, { recursive: true });
    const lockPath = path.join(lockDir, `${botId}.restart.lock`);
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      fs.closeSync(fd);
      return lockPath;
    } catch {
      return null;
    }
  }

  private releaseRestartLock(lockPath: string | null): void {
    if (!lockPath) return;
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // non-fatal
    }
  }

  private async cmuxSend(workspace: string, surface: string, text: string): Promise<void> {
    await execFileP('cmux', ['send', '--workspace', workspace, '--surface', surface, text], {
      timeout: 5_000,
    });
  }

  private async sendRecoveryKeys(workspace: string, surface: string): Promise<void> {
    await this.cmuxSend(workspace, surface, '\x03'); // Ctrl-C
    await new Promise((r) => setTimeout(r, 500));
    await this.cmuxSend(workspace, surface, '\x1b'); // Escape
    await new Promise((r) => setTimeout(r, 500));
    await this.cmuxSend(workspace, surface, '1');
    await this.cmuxSend(workspace, surface, '\n');
    await new Promise((r) => setTimeout(r, 1_000));
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
      const botConfigDir =
        process.env.CLAUDE_CONFIG_DIR_BOTS || `${process.env.HOME}/.claude/snamanager0`;
      const startCmd = `cd ${sessionPath} && CLAUDE_CONFIG_DIR=${botConfigDir} claude --permission-mode bypassPermissions`;
      const now = Date.now();
      const lastRestartAt = this.lastRestartAt.get(botId) ?? 0;
      const cooldownMs = this.restartCooldownMs();
      if (now - lastRestartAt < cooldownMs) {
        if (this.shouldLogFailure(botId, 'cooldown')) {
          console.log(
            `[health] ${botId}: restart cooldown active (${Math.round((cooldownMs - (now - lastRestartAt)) / 1000)}s left)`,
          );
        }
        return;
      }

      if (!this.autoRestartAllowed(botId)) {
        if (this.shouldLogFailure(botId, 'not-allowlisted')) {
          console.log(
            `[health] ${botId}: auto-restart not allowlisted — set SEMO_HEALTH_AUTO_RESTART_BOTS=${botId} to enable`,
          );
        }
        return;
      }

      const paneState = await this.readPaneState(workspace, surface);
      if (paneState !== 'idle') {
        if (this.shouldLogFailure(botId, `pane-${paneState}`)) {
          if (paneState === 'stuck') {
            console.error(
              `[health] ${botId}: pane_state=stuck (Claude Code modal/welcome blocking prompt). ` +
                `cmux send nudge → silent failure. inbox 누적 가능성. ` +
                `Recovery: cmux pane process kill + 새 Claude 세션 (OS-level). ` +
                `KB: semo incident/semobot-quota-and-modal-wake-failure-2026-05-14`,
            );
          } else {
            console.log(`[health] ${botId}: pane_state=${paneState} — skip auto-restart`);
          }
        }
        return;
      }

      if (this.hasRecentOutbox(botId)) {
        if (this.shouldLogFailure(botId, 'recent-outbox')) {
          console.log(`[health] ${botId}: recent outbox activity — skip auto-restart`);
        }
        return;
      }

      const lockPath = this.acquireRestartLock(botId);
      if (!lockPath) {
        if (this.shouldLogFailure(botId, 'lock-held')) {
          console.log(`[health] ${botId}: restart lock held — skip auto-restart`);
        }
        return;
      }

      try {
        const dryRun = process.env.SEMO_HEALTH_AUTO_RESTART_DRY_RUN === '1';
        if (dryRun) {
          console.log(
            `[health] ${botId}: dry-run auto-restart would send recovery keys + start command to ${workspace}/${surface}`,
          );
          this.lastRestartAt.set(botId, Date.now());
          return;
        }

        await this.sendRecoveryKeys(workspace, surface);

        // /quit the existing session (ignore failure — surface might be at shell already)
        await this.cmuxSend(workspace, surface, '/quit').catch(() => {});
        await this.cmuxSend(workspace, surface, '\n').catch(() => {});
        await new Promise((r) => setTimeout(r, 2_000));

        // Start fresh claude session
        await this.cmuxSend(workspace, surface, startCmd);
        await this.cmuxSend(workspace, surface, '\n');
        this.lastRestartAt.set(botId, Date.now());
        if (this.shouldLog(botId, 'restart-sent')) {
          console.log(`[health] ${botId}: restart sent to ${workspace}/${surface}`);
        }
      } catch (err) {
        if (this.shouldLogFailure(botId, 'cmux-failed')) {
          console.error(`[health] ${botId}: cmux restart failed:`, (err as Error).message);
        }
        return;
      } finally {
        this.releaseRestartLock(lockPath);
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
