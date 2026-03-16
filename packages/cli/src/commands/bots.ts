/**
 * semo bots — 봇 상태 관리
 *
 * Actual semo.bot_status schema:
 *   bot_id, name, emoji, role, last_active, session_count, workspace_path, status, synced_at
 *
 * Actual semo.bot_sessions schema:
 *   bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";
import { Pool } from "pg";
import { getPool, closeConnection, isDbConnected } from "../database";

// ============================================================
// Types (matches actual DB schema)
// ============================================================

interface BotStatus {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: string | null;
  last_active: string | null;
  session_count: number;
  workspace_path: string | null;
  synced_at: string | null;
}

interface BotSession {
  bot_id: string;
  session_key: string;
  label: string | null;
  kind: string | null;
  chat_type: string | null;
  last_activity: string | null;
  message_count: number;
}

// ============================================================
// IDENTITY.md parser
// ============================================================

interface BotIdentity {
  name: string | null;
  emoji: string | null;
  role: string | null;
}

function parseIdentityMd(content: string): BotIdentity {
  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/);
  const roleMatch = content.match(/\*\*(?:Creature|Role|직책):\*\*\s*(.+)/);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    emoji: emojiMatch ? emojiMatch[1].trim() : null,
    role: roleMatch ? roleMatch[1].trim() : null,
  };
}

// ============================================================
// Bot workspace scanner
// ============================================================

interface ScannedBot {
  botId: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  lastActive: Date | null;
  workspacePath: string;
}

function scanBotWorkspaces(semoSystemDir: string): ScannedBot[] {
  const workspacesDir = path.join(semoSystemDir, "bot-workspaces");
  if (!fs.existsSync(workspacesDir)) return [];

  const bots: ScannedBot[] = [];

  const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const botId = entry.name;
    const botDir = path.join(workspacesDir, botId);

    // Most recent file mtime
    let lastActive: Date | null = null;
    try {
      const times = getAllFileMtimes(botDir);
      if (times.length > 0) {
        lastActive = new Date(Math.max(...times.map(t => t.getTime())));
      }
    } catch { /* skip */ }

    // Parse IDENTITY.md
    let identity: BotIdentity = { name: null, emoji: null, role: null };
    const identityPath = path.join(botDir, "IDENTITY.md");
    if (fs.existsSync(identityPath)) {
      try {
        identity = parseIdentityMd(fs.readFileSync(identityPath, "utf-8"));
      } catch { /* skip */ }
    }

    bots.push({ botId, ...identity, lastActive, workspacePath: botDir });
  }

  return bots;
}

function getAllFileMtimes(dir: string, depth = 0): Date[] {
  if (depth > 2) return [];
  const times: Date[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        times.push(fs.statSync(fullPath).mtime);
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        times.push(...getAllFileMtimes(fullPath, depth + 1));
      }
    }
  } catch { /* skip */ }
  return times;
}

// ============================================================
// Cron Jobs sync
// ============================================================

interface CronJobRow {
  jobId: string;
  name: string;
  schedule: Record<string, unknown>;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  sessionTarget: string;
}

function parseCronJobsFile(content: string): CronJobRow[] {
  const data = JSON.parse(content) as {
    jobs?: Array<{
      id: string;
      name?: string;
      enabled?: boolean;
      schedule?: Record<string, unknown>;
      sessionTarget?: string;
      state?: { lastRunAtMs?: number; nextRunAtMs?: number };
    }>;
  };
  return (data.jobs || []).map(job => ({
    jobId: job.id,
    name: job.name || "",
    schedule: job.schedule || {},
    enabled: job.enabled !== false,
    lastRun: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs) : null,
    nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs) : null,
    sessionTarget: job.sessionTarget || "main",
  }));
}

async function syncCronJobs(pool: Pool, homeDir: string): Promise<number> {
  const entries = fs.readdirSync(homeDir, { withFileTypes: true });
  const openclawDirs = entries
    .filter(e => e.isDirectory() && e.name.startsWith(".openclaw"))
    .map(e => path.join(homeDir, e.name));

  let syncedCount = 0;

  for (const dir of openclawDirs) {
    const botId = path.basename(dir).replace(/^\.openclaw-?/, "") || "main";
    const jobsPath = path.join(dir, "cron", "jobs.json");

    if (!fs.existsSync(jobsPath)) continue;

    let jobs: CronJobRow[];
    try {
      const content = fs.readFileSync(jobsPath, "utf-8");
      jobs = parseCronJobsFile(content);
    } catch {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("DELETE FROM semo.bot_cron_jobs WHERE bot_id = $1", [botId]);
      for (const job of jobs) {
        await client.query(
          `INSERT INTO semo.bot_cron_jobs
             (bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            botId,
            job.jobId,
            job.name,
            JSON.stringify(job.schedule),
            job.enabled,
            job.lastRun?.toISOString() || null,
            job.nextRun?.toISOString() || null,
            job.sessionTarget,
          ]
        );
      }
      syncedCount++;
    } catch {
      // skip this bot silently
    } finally {
      client.release();
    }
  }

  return syncedCount;
}

// ============================================================
// Command registration
// ============================================================

export function registerBotsCommands(program: Command): void {
  const botsCmd = program
    .command("bots")
    .description("봇 상태 조회 및 관리 (semo.bot_status)");

  // ── semo bots status ────────────────────────────────────────
  botsCmd
    .command("status")
    .description("모든 봇의 현재 상태 조회")
    .option("--status <filter>", "상태 필터 (online|offline)")
    .option("--format <type>", "출력 형식 (table|json)", "table")
    .action(async (options) => {
      const spinner = ora("봇 상태 조회 중...").start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail("DB 연결 실패");
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, name, emoji, role, status,
                 last_active::text, session_count, synced_at::text
          FROM semo.bot_status
        `;
        const params: string[] = [];
        if (options.status) {
          query += " WHERE status = $1";
          params.push(options.status);
        }
        query += " ORDER BY bot_id";

        const result = await client.query(query, params);
        client.release();

        const bots: BotStatus[] = result.rows;
        spinner.stop();

        if (options.format === "json") {
          console.log(JSON.stringify(bots, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n🤖 봇 상태\n"));

          if (bots.length === 0) {
            console.log(chalk.yellow("  봇 상태 데이터가 없습니다."));
            console.log(chalk.gray("  'semo bots sync'로 초기 데이터를 적재하세요."));
          } else {
            console.log(chalk.gray("  봇              이름                    상태       마지막 활동"));
            console.log(chalk.gray("  " + "─".repeat(75)));
            for (const b of bots) {
              const statusIcon = b.status === "online" ? chalk.green("● online ") : chalk.red("○ offline");
              const lastActive = b.last_active
                ? new Date(b.last_active).toLocaleString("ko-KR")
                : "-";
              const displayName = `${b.emoji || ""} ${b.name || b.bot_id}`.trim();
              console.log(
                `  ${b.bot_id.padEnd(16)}${displayName.padEnd(24)}${String(statusIcon).padEnd(12)}${lastActive}`
              );
            }
          }

          console.log();
          const online = bots.filter(b => b.status === "online").length;
          console.log(chalk.gray(`  총 ${bots.length}개 봇 (온라인: ${online}개)\n`));
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sessions ──────────────────────────────────────
  botsCmd
    .command("sessions")
    .description("봇 세션 히스토리 조회")
    .option("--bot <name>", "특정 봇만")
    .option("--limit <n>", "최대 조회 수", "20")
    .option("--format <type>", "출력 형식 (table|json)", "table")
    .action(async (options) => {
      const spinner = ora("세션 조회 중...").start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail("DB 연결 실패");
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        let query = `
          SELECT bot_id, session_key, label, kind, chat_type,
                 last_activity::text, message_count
          FROM semo.bot_sessions
        `;
        const params: (string | number)[] = [];
        let idx = 1;

        if (options.bot) {
          query += ` WHERE bot_id = $${idx++}`;
          params.push(options.bot);
        }
        query += ` ORDER BY last_activity DESC NULLS LAST LIMIT $${idx++}`;
        params.push(parseInt(options.limit));

        const result = await client.query(query, params);
        client.release();

        const sessions: BotSession[] = result.rows;
        spinner.stop();

        if (options.format === "json") {
          console.log(JSON.stringify(sessions, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📋 봇 세션 히스토리\n"));
          if (sessions.length === 0) {
            console.log(chalk.yellow("  세션 데이터가 없습니다."));
          } else {
            for (const s of sessions) {
              const lastActivity = s.last_activity
                ? new Date(s.last_activity).toLocaleString("ko-KR")
                : "-";
              console.log(
                chalk.cyan(`  ${s.bot_id}`) +
                chalk.gray(` [${s.session_key}]`) +
                (s.label ? chalk.white(` "${s.label}"`) : "") +
                chalk.gray(` ${lastActivity} (${s.message_count}msg)`)
              );
            }
          }
          console.log();
        }
      } catch (err) {
        spinner.fail(`조회 실패: ${err}`);
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots sync ──────────────────────────────────────────
  botsCmd
    .command("sync")
    .description("bot-workspaces/ 스캔 → semo.bot_status DB upsert")
    .option("--semo-system <path>", "semo-system 경로 (기본: ./semo-system)")
    .option("--dry-run", "실제 upsert 없이 미리보기")
    .action(async (options) => {
      const cwd = process.cwd();
      const semoSystemDir = options.semoSystem
        ? path.resolve(options.semoSystem)
        : path.join(cwd, "semo-system");

      if (!fs.existsSync(semoSystemDir)) {
        console.log(chalk.red(`\n❌ semo-system 디렉토리를 찾을 수 없습니다: ${semoSystemDir}`));
        process.exit(1);
      }

      const spinner = ora("bot-workspaces 스캔 중...").start();
      const bots = scanBotWorkspaces(semoSystemDir);

      if (bots.length === 0) {
        spinner.warn("봇 워크스페이스가 없습니다.");
        return;
      }

      spinner.text = `${bots.length}개 봇 발견`;

      if (options.dryRun) {
        spinner.stop();
        console.log(chalk.cyan.bold("\n[dry-run] 감지된 봇:\n"));
        for (const bot of bots) {
          const display = [bot.emoji, bot.name].filter(Boolean).join(" ") || bot.botId;
          console.log(
            chalk.gray(`  ${bot.botId.padEnd(16)}`) +
            chalk.white(display.padEnd(24)) +
            chalk.gray(bot.lastActive?.toLocaleString("ko-KR") || "-")
          );
        }
        console.log();
        return;
      }

      spinner.text = `${bots.length}개 봇 DB 반영 중...`;

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail("DB 연결 실패");
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();
      let upserted = 0;
      const errors: string[] = [];

      try {
        await client.query("BEGIN");

        for (const bot of bots) {
          try {
            await client.query(
              `INSERT INTO semo.bot_status
                 (bot_id, name, emoji, role, status, last_active, workspace_path, synced_at)
               VALUES ($1, $2, $3, $4, 'offline', $5, $6, NOW())
               ON CONFLICT (bot_id) DO UPDATE SET
                 name           = COALESCE(EXCLUDED.name, semo.bot_status.name),
                 emoji          = COALESCE(EXCLUDED.emoji, semo.bot_status.emoji),
                 role           = COALESCE(EXCLUDED.role, semo.bot_status.role),
                 last_active    = CASE
                   WHEN EXCLUDED.last_active IS NOT NULL
                     AND (semo.bot_status.last_active IS NULL
                          OR EXCLUDED.last_active > semo.bot_status.last_active)
                   THEN EXCLUDED.last_active
                   ELSE semo.bot_status.last_active
                 END,
                 workspace_path = EXCLUDED.workspace_path,
                 synced_at      = NOW()`,
              [
                bot.botId,
                bot.name,
                bot.emoji,
                bot.role,
                bot.lastActive?.toISOString() || null,
                bot.workspacePath,
              ]
            );
            upserted++;
          } catch (err) {
            errors.push(`${bot.botId}: ${err}`);
          }
        }

        await client.query("COMMIT");

        // session_count를 bot_sessions 실제 집계로 갱신
        await client.query(
          `UPDATE semo.bot_status bs
           SET session_count = (
             SELECT COUNT(*) FROM semo.bot_sessions WHERE bot_id = bs.bot_id
           )`
        );

        spinner.succeed(`bots sync 완료: ${upserted}개 봇 업서트`);
        if (errors.length > 0) {
          errors.forEach(e => console.log(chalk.red(`  ❌ ${e}`)));
        }
      } catch (err) {
        await client.query("ROLLBACK");
        spinner.fail(`sync 실패: ${err}`);
        client.release();
        await closeConnection();
        process.exit(1);
      }

      client.release();
      await closeConnection();

      // sessions sync 연동: DB 연결 반납 후 별도 프로세스로 실행
      console.log(chalk.gray("  → sessions sync 실행 중..."));
      try {
        const semoCmd = process.argv[1];
        spawnSync(process.execPath, [semoCmd, "sessions", "sync", "--all"], {
          stdio: "inherit",
          timeout: 60000,
        });
      } catch {
        console.log(chalk.yellow("  ⚠ sessions sync 호출 실패 (무시)"));
      }

      // cron jobs sync
      console.log(chalk.gray("  → cron jobs sync 실행 중..."));
      try {
        const cronPool = getPool();
        const cronCount = await syncCronJobs(cronPool, os.homedir());
        console.log(chalk.gray(`  → cron jobs sync 완료: ${cronCount}개 봇`));
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ cron jobs sync 실패 (무시): ${err}`));
      } finally {
        await closeConnection();
      }
    });

  // ── semo bots set-status ─────────────────────────────────────
  botsCmd
    .command("set-status <bot_id> <status>")
    .description("봇 온라인 상태 수동 설정 (online|offline)")
    .action(async (botId: string, status: string) => {
      if (status !== "online" && status !== "offline") {
        console.log(chalk.red("❌ status는 'online' 또는 'offline'만 가능합니다."));
        process.exit(1);
      }

      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red("❌ DB 연결 실패"));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();
        await client.query(
          `INSERT INTO semo.bot_status (bot_id, status, synced_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (bot_id) DO UPDATE SET
             status = EXCLUDED.status,
             synced_at = NOW()`,
          [botId, status]
        );
        client.release();
        console.log(chalk.green(`✔ ${botId} → ${status}`));
      } catch (err) {
        console.log(chalk.red(`❌ 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
