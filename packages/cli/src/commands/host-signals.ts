/**
 * semo host-signals — host filesystem/process signal sidecar.
 *
 * Architecture: KB semo decision/dashboard-host-signals-sidecar-2026-05-07.
 *
 * semo-dashboard 는 OKE pod 안이라 host(pgrep / PID 파일 / auth-profiles.json) 직접 접근 불가.
 * 이 sidecar 는 host(=Reus Mac mini) 에서 동작하며 결과를 ${DB_SCHEMA}.host_signals 에 push.
 * dashboard /api/system/health 는 이 테이블을 read-only 로 조회.
 *
 * Subcommands:
 *   semo host-signals push   — 1회 수집 + UPSERT (기본). --interval <sec> 지정 시 daemon 모드
 *   semo host-signals show   — 최근 row 디버그 출력
 *
 * 보안: payload 에 secret 절대 넣지 않음. token 은 prefix(예: sk-ant-oat01) 만.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPool, closeConnection } from '../database';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

interface CollectedSignal {
  signal_type: 'process' | 'pid_file' | 'auth_profile' | 'log_grep' | 'ancestry';
  target_id: string;
  status: 'ok' | 'degraded' | 'fail' | 'expired' | 'unknown';
  payload: Record<string, unknown>;
  observed_at: Date;
  expires_at: Date | null;
}

interface ProcessTarget {
  target_id: string;
  pattern: string;
}

const PROCESS_TARGETS: ProcessTarget[] = [
  { target_id: 'slack-router', pattern: 'slack-router/src/index.ts' },
  { target_id: 'discord-router', pattern: 'discord-router/src/bin.ts' },
  { target_id: 'openclaw-gateway', pattern: 'openclaw.*gateway' },
];

function defaultSourceHost(): string {
  return os
    .hostname()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-');
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// ============================================================
// Collectors
// ============================================================

interface PsRow {
  pid: number;
  ppid: number;
  tty: string;
  etime: string;
  command: string;
}

function pgrepDetail(pattern: string): PsRow[] {
  // pgrep -fl returns "PID command…"; we want PPID/TTY too → ps -o pid,ppid,tty,etime,command for pgrep results.
  const pidsRaw = safeExec(`pgrep -f ${JSON.stringify(pattern)}`);
  if (!pidsRaw) return [];
  const pids = pidsRaw.split(/\s+/).filter(Boolean);
  const rows: PsRow[] = [];
  for (const pidStr of pids) {
    const pid = Number(pidStr);
    if (!Number.isFinite(pid)) continue;
    const out = safeExec(`ps -p ${pid} -o pid=,ppid=,tty=,etime=,command=`);
    if (!out) continue;
    // tty/command may contain spaces; greedy-trim by structure:
    const m = out.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    rows.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      tty: m[3],
      etime: m[4],
      command: m[5].slice(0, 200),
    });
  }
  return rows;
}

function collectProcessAndAncestry(now: Date): CollectedSignal[] {
  const signals: CollectedSignal[] = [];
  for (const target of PROCESS_TARGETS) {
    const rows = pgrepDetail(target.pattern);
    if (rows.length === 0) {
      signals.push({
        signal_type: 'process',
        target_id: target.target_id,
        status: 'fail',
        payload: { pattern: target.pattern, found: 0 },
        observed_at: now,
        expires_at: null,
      });
      // ancestry signal still emitted as fail when there is no process
      signals.push({
        signal_type: 'ancestry',
        target_id: target.target_id,
        status: 'fail',
        payload: { reason: 'no-process' },
        observed_at: now,
        expires_at: null,
      });
      continue;
    }
    // Pick the first row as primary (multiple PIDs are typical: npm-exec wrapper + tsx + node)
    const primary = rows[0];
    signals.push({
      signal_type: 'process',
      target_id: target.target_id,
      status: 'ok',
      payload: {
        pid: primary.pid,
        ppid: primary.ppid,
        tty: primary.tty,
        etime: primary.etime,
        command: primary.command,
        process_count: rows.length,
      },
      observed_at: now,
      expires_at: null,
    });
    // Ancestry: cmux ancestry guard requires TTY != '??' AND PPID != 1.
    const daemonized = primary.tty === '??' || primary.ppid === 1;
    signals.push({
      signal_type: 'ancestry',
      target_id: target.target_id,
      status: daemonized ? 'degraded' : 'ok',
      payload: {
        pid: primary.pid,
        ppid: primary.ppid,
        tty: primary.tty,
        daemonized,
      },
      observed_at: now,
      expires_at: null,
    });
  }
  return signals;
}

function collectPidFiles(now: Date): CollectedSignal[] {
  const dir = path.join(os.homedir(), '.semo', 'run');
  const signals: CollectedSignal[] = [];
  if (!fs.existsSync(dir)) return signals;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.pid')) continue;
    const target = entry.replace(/\.pid$/, '');
    const fullPath = path.join(dir, entry);
    let pid = 0;
    let alive = false;
    try {
      const raw = fs.readFileSync(fullPath, 'utf8').trim();
      pid = Number(raw);
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          alive = true;
        } catch {
          alive = false;
        }
      }
    } catch {
      /* unreadable */
    }
    signals.push({
      signal_type: 'pid_file',
      target_id: target,
      status: alive ? 'ok' : 'fail',
      payload: { pid, pid_file: fullPath, alive },
      observed_at: now,
      expires_at: null,
    });
  }
  return signals;
}

function tokenFormat(token: string | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  // Anthropic token: sk-ant-oat01-...
  const ant = token.match(/^(sk-ant-[a-z0-9]+)/i);
  if (ant) return ant[1];
  // OpenAI codex JWT: eyJ...
  if (token.startsWith('eyJ')) return 'jwt';
  return token.slice(0, 8);
}

function collectAuthProfiles(now: Date): CollectedSignal[] {
  const home = os.homedir();
  const signals: CollectedSignal[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(home).filter((e) => e.startsWith('.openclaw-'));
  } catch {
    return signals;
  }
  for (const entry of entries) {
    const botId = entry.replace(/^\.openclaw-/, '');
    // Skip non-bot helper dirs: .openclaw-shared (shared template), .openclaw-shared.bak (symlink), etc.
    if (botId === 'shared' || botId.includes('.')) continue;
    const profilePath = path.join(home, entry, 'agents', 'main', 'agent', 'auth-profiles.json');
    if (!fs.existsSync(profilePath)) {
      signals.push({
        signal_type: 'auth_profile',
        target_id: botId,
        status: 'fail',
        payload: { reason: 'missing', path: profilePath },
        observed_at: now,
        expires_at: null,
      });
      continue;
    }
    let parsed: {
      profiles?: Record<string, { provider?: string; access?: string; expires?: number }>;
    } = {};
    try {
      parsed = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    } catch (err) {
      signals.push({
        signal_type: 'auth_profile',
        target_id: botId,
        status: 'unknown',
        payload: { reason: 'parse-error', error: String(err).slice(0, 120) },
        observed_at: now,
        expires_at: null,
      });
      continue;
    }
    const profiles = parsed.profiles ?? {};
    const summary: Array<{
      key: string;
      provider: string;
      expires_at: string | null;
      token_format: string | null;
      expired: boolean;
    }> = [];
    let anyExpired = false;
    let earliestExpiry: number | null = null;
    for (const [key, p] of Object.entries(profiles)) {
      const expiresMs = typeof p.expires === 'number' ? p.expires : null;
      const expired = expiresMs !== null && expiresMs <= now.getTime();
      if (expired) anyExpired = true;
      if (expiresMs !== null && (earliestExpiry === null || expiresMs < earliestExpiry)) {
        earliestExpiry = expiresMs;
      }
      summary.push({
        key,
        provider: p.provider ?? 'unknown',
        expires_at: expiresMs ? new Date(expiresMs).toISOString() : null,
        token_format: tokenFormat(p.access),
        expired,
      });
    }
    signals.push({
      signal_type: 'auth_profile',
      target_id: botId,
      status: summary.length === 0 ? 'fail' : anyExpired ? 'expired' : 'ok',
      payload: { profiles: summary, profile_count: summary.length },
      observed_at: now,
      expires_at: earliestExpiry ? new Date(earliestExpiry) : null,
    });
  }
  return signals;
}

function collectAll(now: Date): CollectedSignal[] {
  return [...collectProcessAndAncestry(now), ...collectPidFiles(now), ...collectAuthProfiles(now)];
}

// ============================================================
// Persistence
// ============================================================

async function upsertSignals(
  sourceHost: string,
  signals: CollectedSignal[],
): Promise<{ inserted: number; updated: number }> {
  if (signals.length === 0) return { inserted: 0, updated: 0 };
  const pool = getPool();
  let inserted = 0;
  let updated = 0;
  for (const s of signals) {
    const res = await pool.query<{ xmax: string }>(
      `INSERT INTO ${DB_SCHEMA}.host_signals
         (source_host, signal_type, target_id, status, payload, observed_at, recorded_at, expires_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), $7)
       ON CONFLICT (source_host, signal_type, target_id)
       DO UPDATE SET
         status      = EXCLUDED.status,
         payload     = EXCLUDED.payload,
         observed_at = EXCLUDED.observed_at,
         recorded_at = NOW(),
         expires_at  = EXCLUDED.expires_at
       RETURNING xmax::text`,
      [
        sourceHost,
        s.signal_type,
        s.target_id,
        s.status,
        JSON.stringify(s.payload),
        s.observed_at,
        s.expires_at,
      ],
    );
    if (res.rows[0]?.xmax === '0') inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

// ============================================================
// Commands
// ============================================================

export function registerHostSignalsCommands(program: Command): void {
  const cmd = program
    .command('host-signals')
    .description(`Host filesystem/process signal sidecar (push to ${DB_SCHEMA}.host_signals)`);

  cmd
    .command('push')
    .description(`Collect host signals and UPSERT to ${DB_SCHEMA}.host_signals`)
    .option('--source-host <name>', 'source host identifier (default: hostname)')
    .option('--interval <sec>', 'daemon mode: repeat every N seconds (omit for one-shot)')
    .option('--quiet', 'suppress per-cycle stdout (errors still printed)')
    .action(async (opts: { sourceHost?: string; interval?: string; quiet?: boolean }) => {
      const sourceHost = opts.sourceHost ?? defaultSourceHost();
      const interval = opts.interval ? Math.max(10, Number(opts.interval)) : null;

      const runOnce = async () => {
        const now = new Date();
        const signals = collectAll(now);
        try {
          const result = await upsertSignals(sourceHost, signals);
          if (!opts.quiet) {
            console.log(
              `${chalk.gray(now.toISOString())} ${chalk.cyan(sourceHost)} ` +
                `signals=${signals.length} inserted=${result.inserted} updated=${result.updated}`,
            );
          }
        } catch (err) {
          console.error(chalk.red('[host-signals push] error:'), err);
          if (!interval) process.exitCode = 1;
        }
      };

      if (interval === null) {
        await runOnce();
        await closeConnection();
        return;
      }

      // Daemon loop. Stays alive until SIGINT/SIGTERM.
      console.log(
        chalk.green(`[host-signals push] daemon start `) +
          `source_host=${sourceHost} interval=${interval}s`,
      );
      let stopping = false;
      const stop = (sig: string) => {
        if (stopping) return;
        stopping = true;
        console.log(chalk.yellow(`[host-signals push] received ${sig}, shutting down`));
        closeConnection().finally(() => process.exit(0));
      };
      process.on('SIGINT', () => stop('SIGINT'));
      process.on('SIGTERM', () => stop('SIGTERM'));

      // First run immediately, then setInterval.
      await runOnce();
      setInterval(() => {
        if (!stopping) void runOnce();
      }, interval * 1000);
    });

  cmd
    .command('show')
    .description('Show recent host_signals rows')
    .option('--source-host <name>', 'filter by source_host')
    .option('--target <id>', 'filter by target_id')
    .option('--limit <n>', 'row limit', '50')
    .action(async (opts: { sourceHost?: string; target?: string; limit?: string }) => {
      const limit = Math.max(1, Math.min(500, Number(opts.limit ?? '50') || 50));
      const params: unknown[] = [];
      const where: string[] = [];
      if (opts.sourceHost) {
        params.push(opts.sourceHost);
        where.push(`source_host = $${params.length}`);
      }
      if (opts.target) {
        params.push(opts.target);
        where.push(`target_id = $${params.length}`);
      }
      params.push(limit);
      const sql = `SELECT source_host, signal_type, target_id, status,
                          EXTRACT(EPOCH FROM (NOW() - recorded_at))::int AS age_sec,
                          payload
                   FROM ${DB_SCHEMA}.host_signals
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY recorded_at DESC
                   LIMIT $${params.length}`;
      try {
        const res = await getPool().query(sql, params);
        if (res.rows.length === 0) {
          console.log(chalk.gray('(no rows)'));
        } else {
          for (const r of res.rows) {
            const stale = r.age_sec > 300;
            const ageLabel = stale ? chalk.red(`${r.age_sec}s`) : chalk.green(`${r.age_sec}s`);
            console.log(
              `${chalk.cyan(r.source_host)} ${chalk.yellow(r.signal_type.padEnd(13))} ` +
                `${r.target_id.padEnd(20)} ${r.status.padEnd(9)} age=${ageLabel}`,
            );
          }
        }
      } finally {
        await closeConnection();
      }
    });
}
