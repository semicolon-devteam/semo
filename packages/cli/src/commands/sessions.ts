/**
 * semo sessions — 세션 추적
 *
 * Claude Code 훅(SessionStart / Stop)에서 stdin으로 전달되는 JSON을 파싱해
 * semo.bot_sessions 테이블에 upsert합니다.
 *
 * Claude Code hook stdin 구조:
 *   SessionStart: { session_id, transcript_path, cwd, hook_event_name }
 *   Stop:         { session_id, transcript_path, hook_event_name }
 *
 * 사용법 (settings.json hooks):
 *   SessionStart → semo sessions push --bot-id workclaw --event start
 *   Stop         → semo sessions push --bot-id workclaw --event stop
 */

import { Command } from "commander";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execSync } from "child_process";
import { getPool, closeConnection, isDbConnected } from "../database";

// ─── Hook JSON (Claude Code stdin) ───────────────────────────────────────────

interface HookPayload {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
}

async function readStdin(): Promise<HookPayload> {
  // stdin이 TTY면 hook에서 호출된 게 아님 → 빈 객체 반환
  if (process.stdin.isTTY) return {};

  return new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (raw += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    // 500ms 타임아웃 — stdin이 오지 않으면 그냥 진행
    setTimeout(() => resolve({}), 500);
  });
}

// ─── 현재 git 브랜치 (label용) ───────────────────────────────────────────────

function getGitBranch(cwd?: string): string | null {
  try {
    const dir = cwd || process.cwd();
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dir,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ─── transcript.jsonl 메시지 수 카운트 ───────────────────────────────────────

async function countMessages(transcriptPath: string): Promise<number> {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;

  return new Promise((resolve) => {
    let count = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath),
      crlfDelay: Infinity,
    });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        // role이 있는 메시지(user/assistant)만 카운트
        if (obj.role === "user" || obj.role === "assistant") count++;
      } catch {
        // invalid line skip
      }
    });
    rl.on("close", () => resolve(count));
    rl.on("error", () => resolve(0));
  });
}

// ─── Command registration ─────────────────────────────────────────────────────

export function registerSessionsCommands(program: Command): void {
  const sessionsCmd = program
    .command("sessions")
    .description("세션 추적 (Claude Code 훅 연동)");

  // ── semo sessions push ───────────────────────────────────────────────────────
  sessionsCmd
    .command("push")
    .description("현재 세션을 semo.bot_sessions에 기록 (훅에서 호출)")
    .requiredOption("--bot-id <id>", "봇 ID (e.g. workclaw)")
    .option("--event <type>", "이벤트 종류 (start|stop|heartbeat)", "heartbeat")
    .option("--label <text>", "세션 라벨 (미지정 시 git 브랜치 자동 감지)")
    .option("--kind <kind>", "세션 종류 (main|isolated)", "main")
    .action(async (options) => {
      const botId: string = options.botId;
      const event: string = options.event;

      // stdin에서 Claude Code hook JSON 읽기
      const hook = await readStdin();

      const sessionKey =
        hook.session_id ||
        process.env.CLAUDE_SESSION_ID ||
        `${botId}-${Date.now()}`;

      const branch = getGitBranch(hook.cwd);
      const label =
        options.label ||
        branch ||
        path.basename(hook.cwd || process.cwd());

      const messageCount =
        event === "stop" && hook.transcript_path
          ? await countMessages(hook.transcript_path)
          : undefined;

      const connected = await isDbConnected();
      if (!connected) {
        // 훅에서 호출 시 조용히 실패 (봇 세션에 영향 주지 않도록)
        await closeConnection();
        process.exit(0);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        if (event === "start") {
          await client.query(
            `INSERT INTO semo.bot_sessions
               (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
             VALUES ($1, $2, $3, $4, 'claude-code', NOW(), 0, NOW())
             ON CONFLICT (bot_id, session_key) DO UPDATE SET
               label         = EXCLUDED.label,
               last_activity = NOW(),
               synced_at     = NOW()`,
            [botId, sessionKey, label, options.kind]
          );

          // bot_status.session_count 갱신
          await client.query(
            `UPDATE semo.bot_status
             SET session_count = (
               SELECT COUNT(*) FROM semo.bot_sessions WHERE bot_id = $1
             ),
             synced_at = NOW()
             WHERE bot_id = $1`,
            [botId]
          );
        } else if (event === "stop") {
          await client.query(
            `UPDATE semo.bot_sessions
             SET last_activity = NOW(),
                 message_count = COALESCE($1, message_count),
                 synced_at     = NOW()
             WHERE bot_id = $2 AND session_key = $3`,
            [messageCount ?? null, botId, sessionKey]
          );
        } else {
          // heartbeat — 마지막 활동 시간 + 메시지 수 갱신
          await client.query(
            `INSERT INTO semo.bot_sessions
               (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
             VALUES ($1, $2, $3, $4, 'claude-code', NOW(), COALESCE($5, 0), NOW())
             ON CONFLICT (bot_id, session_key) DO UPDATE SET
               last_activity = NOW(),
               message_count = COALESCE(EXCLUDED.message_count, semo.bot_sessions.message_count),
               synced_at     = NOW()`,
            [botId, sessionKey, label, options.kind, messageCount ?? null]
          );

          // bot_status.session_count 갱신
          await client.query(
            `UPDATE semo.bot_status
             SET session_count = (
               SELECT COUNT(*) FROM semo.bot_sessions WHERE bot_id = $1
             ),
             synced_at = NOW()
             WHERE bot_id = $1`,
            [botId]
          );
        }

        client.release();
        console.log(chalk.green(`✔ sessions push [${event}] ${botId}/${sessionKey.slice(0, 8)}`));
      } catch (err) {
        // 훅에서 호출 시 조용히 실패
        console.error(chalk.red(`sessions push 실패: ${err}`));
        process.exit(0);
      } finally {
        await closeConnection();
      }
    });

  // ── semo sessions list ───────────────────────────────────────────────────────
  sessionsCmd
    .command("list")
    .description("bot_sessions 테이블 조회")
    .option("--bot-id <id>", "특정 봇만")
    .option("--limit <n>", "최대 조회 수", "20")
    .option("--format <type>", "출력 형식 (table|json)", "table")
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red("❌ DB 연결 실패"));
        await closeConnection();
        process.exit(1);
      }

      try {
        const pool = getPool();
        const client = await pool.connect();

        const params: (string | number)[] = [];
        let where = "";
        if (options.botId) {
          where = "WHERE bot_id = $1";
          params.push(options.botId);
        }
        params.push(parseInt(options.limit));
        const limitIdx = params.length;

        const result = await client.query(
          `SELECT bot_id, session_key, label, kind, chat_type,
                  last_activity::text, message_count
           FROM semo.bot_sessions
           ${where}
           ORDER BY last_activity DESC NULLS LAST
           LIMIT $${limitIdx}`,
          params
        );
        client.release();

        if (options.format === "json") {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(chalk.cyan.bold("\n📋 세션 목록\n"));
          if (result.rows.length === 0) {
            console.log(chalk.yellow("  세션 없음"));
          } else {
            for (const s of result.rows) {
              const ts = s.last_activity
                ? new Date(s.last_activity).toLocaleString("ko-KR")
                : "-";
              console.log(
                chalk.cyan(`  ${s.bot_id.padEnd(14)}`) +
                chalk.white(`${(s.label || s.session_key).padEnd(30)}`) +
                chalk.gray(`${ts}  ${s.message_count}msg`)
              );
            }
          }
          console.log();
        }
      } catch (err) {
        console.log(chalk.red(`❌ 조회 실패: ${err}`));
        process.exit(1);
      } finally {
        await closeConnection();
      }
    });
}
