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
import { getPool, closeConnection, isDbConnected } from "../database";
import { syncBotSessions } from "./sessions";

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
  // P2-2: 대소문자 무시, **Key:**/Key: 양쪽 지원, 100자 초과 시 잘못된 파싱으로 간주
  const nameMatch = content.match(/(?:\*\*)?Name:(?:\*\*)?\s*(.+)/i);
  const emojiMatch = content.match(/(?:\*\*)?Emoji:(?:\*\*)?\s*(\S+)/i);
  const roleMatch = content.match(/(?:\*\*)?(?:Creature|Role|직책):(?:\*\*)?\s*(.+)/i);

  const name = nameMatch ? nameMatch[1].trim() : null;
  const emoji = emojiMatch ? emojiMatch[1].trim() : null;
  const role = roleMatch ? roleMatch[1].trim() : null;

  return {
    name: name && name.length <= 100 ? name : null,
    emoji: emoji && emoji.length <= 10 ? emoji : null,
    role: role && role.length <= 100 ? role : null,
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
                 status         = semo.bot_status.status,
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
        spinner.succeed(`bots sync 완료: ${upserted}개 봇 업서트`);
        if (errors.length > 0) {
          errors.forEach(e => console.log(chalk.red(`  ❌ ${e}`)));
        }

        // P2-1: sessions sync 연동 — spawnSync 대신 같은 프로세스에서 직접 호출
        try {
          const botIds = bots.map(b => b.botId);
          console.log(chalk.gray("  → sessions sync 실행 중..."));
          const sessionsClient = await pool.connect();
          const { total } = await syncBotSessions(botIds, sessionsClient);
          sessionsClient.release();
          if (total > 0) {
            console.log(chalk.green(`  → sessions sync 완료: ${total}건 upsert`));
          }
        } catch {
          console.log(chalk.yellow("  ⚠ sessions sync 실패 (무시)"));
        }
      } catch (err) {
        await client.query("ROLLBACK");
        spinner.fail(`sync 실패: ${err}`);
        process.exit(1);
      } finally {
        client.release();
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
