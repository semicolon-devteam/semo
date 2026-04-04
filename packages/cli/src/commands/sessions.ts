/**
 * semo sessions — 세션 추적
 *
 * sync: 각 봇의 OpenClaw 게이트웨이(HTTP API) 또는 로컬 sessions.json에서
 *       세션 데이터를 읽어 semo.bot_sessions에 upsert합니다.
 *
 * push: Claude Code 훅(SessionStart / Stop)에서 stdin으로 전달되는 JSON을 파싱해
 *       semo.bot_sessions 테이블에 upsert합니다. (Claude Code 직접 실행 시에만 유효)
 *
 * OpenClaw 봇은 게이트웨이(WS/HTTP 서버)로 운영되어 Claude Code 훅이 트리거되지 않으므로
 * semo sessions sync --all 로 주기적으로 동기화해야 합니다.
 *
 * 게이트웨이 설정 위치: ~/.openclaw-{botId}/openclaw.json
 *   gateway.port: 포트번호
 *   gateway.auth.token: Bearer 토큰
 *
 * HTTP API: POST http://127.0.0.1:{port}/tools/invoke
 *   { tool: "sessions_list", action: "json", args: {} }
 *   응답: { ok: true, result: { content: [{ type: "text", text: "<JSON string>" }] } }
 *   inner JSON: { count: N, sessions: [{ key, kind, channel, displayName, updatedAt, totalTokens }] }
 *
 * Fallback: ~/.openclaw-{botId}/agents/main/sessions/sessions.json
 *   { "agent:main:slack:channel:xxx": { updatedAt: <unix ms>, ... }, ... }
 */

import { Command } from "commander";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as os from "os";
import { execSync } from "child_process";
import { PoolClient } from "pg";
import { getPool, closeConnection, isDbConnected } from "../database";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GatewaySession {
  key: string;
  kind?: string;
  channel?: string;
  displayName?: string;
  updatedAt?: number;
  totalTokens?: number;
}

interface OpenClawConfig {
  gateway?: {
    port?: number;
    auth?: { token?: string };
  };
}

// ─── OpenClaw config reader ─────────────────────────────────────────────────

function readOpenClawConfig(botId: string): OpenClawConfig | null {
  const configPath = path.join(os.homedir(), `.openclaw-${botId}`, "openclaw.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

// ─── HTTP API로 게이트웨이에서 세션 목록 조회 ───────────────────────────────

async function fetchSessionsFromGateway(botId: string): Promise<GatewaySession[] | null> {
  const config = readOpenClawConfig(botId);
  if (!config?.gateway?.port || !config?.gateway?.auth?.token) return null;

  const { port, auth } = config.gateway;
  const token = auth.token!;
  const url = `http://127.0.0.1:${port}/tools/invoke`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const outer = await res.json() as any;
    if (!outer.ok) return null;

    // 이중 JSON 파싱: result.content[0].text가 JSON 문자열
    const textContent = outer.result?.content?.find((c: any) => c.type === "text")?.text;
    if (!textContent) return null;

    const inner = JSON.parse(textContent);
    return inner.sessions ?? null;
  } catch {
    return null;
  }
}

// ─── Fallback: 로컬 sessions.json 파일 파싱 ────────────────────────────────

function readSessionsFromFile(botId: string): GatewaySession[] | null {
  const sessionsPath = path.join(
    os.homedir(), `.openclaw-${botId}`, "agents", "main", "sessions", "sessions.json"
  );
  if (!fs.existsSync(sessionsPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(sessionsPath, "utf-8"));
    return Object.entries(raw).map(([key, val]: [string, any]) => ({
      key,
      updatedAt: val.updatedAt,
    }));
  } catch {
    return null;
  }
}

// ─── GatewaySession → DB 컬럼 매핑 ─────────────────────────────────────────

function mapSessionToDb(s: GatewaySession) {
  const kind = s.kind === "group" ? "isolated" : "main";
  let chatType = s.channel ?? "direct";
  if (!s.channel) {
    if (s.key.includes(":slack:")) chatType = "slack";
    else if (s.key.includes(":cron:")) chatType = "cron";
  }
  const label = s.displayName ?? s.key.split(":").slice(-2).join(":");
  const lastActivity = s.updatedAt ? new Date(s.updatedAt).toISOString() : null;
  return { kind, chatType, label, lastActivity, totalTokens: s.totalTokens ?? null };
}

// ─── stdin reader ───────────────────────────────────────────────────────────

async function readStdin(): Promise<Record<string, any>> {
  if (process.stdin.isTTY) return {};

  return new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => (raw += chunk));
    process.stdin.on("end", () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    setTimeout(() => resolve({}), 500);
  });
}

// ─── 현재 git 브랜치 (label용) ──────────────────────────────────────────────

function getGitBranch(cwd?: string): string | null {
  try {
    const dir = cwd || process.cwd();
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dir,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).toString().trim();
  } catch {
    return null;
  }
}

// ─── transcript.jsonl 메시지 수 카운트 ──────────────────────────────────────

async function countMessages(transcriptPath: string): Promise<number> {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;

  return new Promise((resolve) => {
    let count = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(transcriptPath),
      crlfDelay: Infinity,
    });
    rl.on("line", (line: string) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        if (obj.role === "user" || obj.role === "assistant") count++;
      } catch { /* invalid line skip */ }
    });
    rl.on("close", () => resolve(count));
    rl.on("error", () => resolve(0));
  });
}

// ─── 외부에서 호출 가능한 sync 헬퍼 ────────────────────────────────────────

export async function syncBotSessions(
  botIds: string[],
  client: PoolClient
): Promise<{ total: number }> {
  let totalUpserted = 0;

  for (const botId of botIds) {
    let sessions = await fetchSessionsFromGateway(botId);
    if (!sessions) sessions = readSessionsFromFile(botId);
    if (!sessions || sessions.length === 0) continue;

    let upserted = 0;
    let latestActivity: Date | null = null;

    for (const s of sessions) {
      try {
        const { kind, chatType, label, lastActivity, totalTokens } = mapSessionToDb(s);
        await client.query(
          `INSERT INTO semo.bot_sessions
             (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (bot_id, session_key) DO UPDATE SET
             label         = EXCLUDED.label,
             kind          = EXCLUDED.kind,
             chat_type     = EXCLUDED.chat_type,
             last_activity = COALESCE(EXCLUDED.last_activity, semo.bot_sessions.last_activity),
             message_count = COALESCE(EXCLUDED.message_count, semo.bot_sessions.message_count),
             synced_at     = NOW()`,
          [botId, s.key, label, kind, chatType, lastActivity, totalTokens]
        );
        upserted++;
        if (lastActivity) {
          const d = new Date(lastActivity);
          if (!latestActivity || d > latestActivity) latestActivity = d;
        }
      } catch { /* 개별 세션 실패 무시 */ }
    }

    // session_count는 trg_session_count 트리거가 자동 관리
    // last_active만 업데이트
    try {
      await client.query(
        `UPDATE semo.bot_status
         SET last_active = CASE
               WHEN $2::timestamptz IS NOT NULL
                 AND (last_active IS NULL OR $2::timestamptz > last_active)
               THEN $2::timestamptz
               ELSE last_active
             END,
             synced_at = NOW()
         WHERE bot_id = $1`,
        [botId, latestActivity?.toISOString() ?? null]
      );
    } catch { /* bot_status 없으면 무시 */ }

    totalUpserted += upserted;
  }

  return { total: totalUpserted };
}

// ─── Command registration ───────────────────────────────────────────────────

export function registerSessionsCommands(program: Command): void {
  const sessionsCmd = program
    .command("sessions")
    .description("세션 추적 (Claude Code 훅 연동)");

  // ── semo sessions push ────────────────────────────────────────────────────
  sessionsCmd
    .command("push")
    .description("현재 세션을 semo.bot_sessions에 기록 (훅에서 호출)")
    .requiredOption("--bot-id <id>", "봇 ID (e.g. workclaw)")
    .option("--event <type>", "이벤트 종류 (start|stop|heartbeat)", "heartbeat")
    .option("--label <text>", "세션 라벨 (미지정 시 git 브랜치 자동 감지)")
    .option("--kind <kind>", "세션 종류 (main|isolated)", "main")
    .action(async (options) => {
      const botId = options.botId;
      const event = options.event;

      const hook = await readStdin();
      const sessionKey = hook.session_id
        || process.env.CLAUDE_SESSION_ID
        || `${botId}-${Date.now()}`;

      const branch = getGitBranch(hook.cwd);
      const label = options.label
        || branch
        || path.basename(hook.cwd || process.cwd());

      const messageCount = event === "stop" && hook.transcript_path
        ? await countMessages(hook.transcript_path)
        : undefined;

      const connected = await isDbConnected();
      if (!connected) {
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
          // session_count는 trg_session_count 트리거가 자동 관리
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
          // heartbeat
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
          // session_count는 trg_session_count 트리거가 자동 관리
        }

        client.release();
        console.log(chalk.green(`✔ sessions push [${event}] ${botId}/${sessionKey.slice(0, 8)}`));
      } catch (err) {
        console.error(chalk.red(`sessions push 실패: ${err}`));
        process.exit(0);
      } finally {
        await closeConnection();
      }
    });

  // ── semo sessions sync ────────────────────────────────────────────────────
  sessionsCmd
    .command("sync")
    .description("OpenClaw 게이트웨이에서 세션 읽어 DB upsert")
    .option("--bot-id <id>", "특정 봇만 동기화")
    .option("--all", "semo.bot_status의 모든 봇 동기화")
    .action(async (options) => {
      const connected = await isDbConnected();
      if (!connected) {
        console.log(chalk.red("❌ DB 연결 실패"));
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();

      let botIds: string[] = [];
      if (options.botId) {
        botIds = [options.botId];
      } else if (options.all) {
        try {
          const r = await client.query("SELECT bot_id FROM semo.bot_status ORDER BY bot_id");
          botIds = r.rows.map((row: any) => row.bot_id);
        } catch {
          const home = os.homedir();
          botIds = fs.readdirSync(home)
            .filter(d => d.startsWith(".openclaw-"))
            .map(d => d.replace(".openclaw-", ""))
            .filter(id => id.length > 0);
        }
      } else {
        console.log(chalk.yellow("  --bot-id <id> 또는 --all 옵션 필요"));
        client.release();
        await closeConnection();
        process.exit(1);
      }

      if (botIds.length === 0) {
        console.log(chalk.yellow("  동기화할 봇 없음"));
        client.release();
        await closeConnection();
        return;
      }

      console.log(chalk.cyan(`\n🔄 sessions sync — ${botIds.length}개 봇\n`));

      let totalUpserted = 0;
      for (const botId of botIds) {
        process.stdout.write(chalk.gray(`  ${botId.padEnd(14)}`));

        let sessions = await fetchSessionsFromGateway(botId);
        let source = "gateway";
        if (!sessions) {
          sessions = readSessionsFromFile(botId);
          source = "file";
        }

        if (!sessions || sessions.length === 0) {
          console.log(chalk.yellow("세션 없음 (게이트웨이 오프라인, 파일 없음)"));
          continue;
        }

        let upserted = 0;
        let latestActivity: Date | null = null;

        for (const s of sessions) {
          try {
            const { kind, chatType, label, lastActivity, totalTokens } = mapSessionToDb(s);
            await client.query(
              `INSERT INTO semo.bot_sessions
                 (bot_id, session_key, label, kind, chat_type, last_activity, message_count, synced_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (bot_id, session_key) DO UPDATE SET
                 label         = EXCLUDED.label,
                 kind          = EXCLUDED.kind,
                 chat_type     = EXCLUDED.chat_type,
                 last_activity = COALESCE(EXCLUDED.last_activity, semo.bot_sessions.last_activity),
                 message_count = COALESCE(EXCLUDED.message_count, semo.bot_sessions.message_count),
                 synced_at     = NOW()`,
              [botId, s.key, label, kind, chatType, lastActivity, totalTokens]
            );
            upserted++;
            if (lastActivity) {
              const d = new Date(lastActivity);
              if (!latestActivity || d > latestActivity) latestActivity = d;
            }
          } catch { /* 개별 세션 실패 무시 */ }
        }

        // session_count는 trg_session_count 트리거가 자동 관리
        // last_active만 업데이트
        try {
          await client.query(
            `UPDATE semo.bot_status
             SET last_active = CASE
                   WHEN $2::timestamptz IS NOT NULL
                     AND (last_active IS NULL OR $2::timestamptz > last_active)
                   THEN $2::timestamptz
                   ELSE last_active
                 END,
                 synced_at = NOW()
             WHERE bot_id = $1`,
            [botId, latestActivity?.toISOString() ?? null]
          );
        } catch { /* bot_status 없으면 무시 */ }

        totalUpserted += upserted;
        console.log(
          chalk.green(`✔ ${upserted}개`) +
          chalk.gray(` (${source}, total ${sessions.length})`)
        );
      }

      client.release();
      console.log(chalk.green(`\n✅ sessions sync 완료 — 총 ${totalUpserted}건 upsert\n`));
      await closeConnection();
    });

  // ── semo sessions list ────────────────────────────────────────────────────
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

  // ── semo sessions digest ──────────────────────────────────────────────────
  sessionsCmd
    .command("digest")
    .description("세션 transcript에서 미기록 의사결정 추출")
    .option("--transcript <path>", "transcript JSONL 파일 경로")
    .option("--session-dir <dir>", "세션 디렉토리 (최신 transcript 자동 선택)")
    .option("--hours <n>", "최근 N시간 내 transcript만 (session-dir 사용 시)", "24")
    .option("--format <type>", "출력 형식 (table|json)", "table")
    .option("--output <path>", "결과를 파일로 출력")
    .action(async (options) => {
      // transcript 파일 찾기
      let transcripts: string[] = [];

      if (options.transcript) {
        if (!fs.existsSync(options.transcript)) {
          console.error(chalk.red(`❌ 파일 없음: ${options.transcript}`));
          process.exit(1);
        }
        transcripts = [options.transcript];
      } else if (options.sessionDir) {
        const dir = options.sessionDir;
        if (!fs.existsSync(dir)) {
          console.error(chalk.red(`❌ 디렉토리 없음: ${dir}`));
          process.exit(1);
        }
        const hours = parseInt(options.hours) || 24;
        const cutoff = Date.now() - hours * 60 * 60 * 1000;
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith(".jsonl"))
          .map(f => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
          .filter(f => f.mtime > cutoff)
          .sort((a, b) => b.mtime - a.mtime);
        transcripts = files.map(f => f.path);
      } else {
        // 기본: 현재 semo 프로젝트의 세션 디렉토리
        const semoSessionDir = path.join(
          os.homedir(), ".claude", "projects",
          "-Users-reus-Desktop-Sources-semicolon-projects-semo"
        );
        if (fs.existsSync(semoSessionDir)) {
          const hours = parseInt(options.hours) || 24;
          const cutoff = Date.now() - hours * 60 * 60 * 1000;
          const files = fs.readdirSync(semoSessionDir)
            .filter(f => f.endsWith(".jsonl"))
            .map(f => ({ name: f, path: path.join(semoSessionDir, f), mtime: fs.statSync(path.join(semoSessionDir, f)).mtimeMs }))
            .filter(f => f.mtime > cutoff)
            .sort((a, b) => b.mtime - a.mtime);
          transcripts = files.map(f => f.path);
        }
      }

      if (transcripts.length === 0) {
        console.log(chalk.yellow("⚠ 분석할 transcript가 없습니다."));
        process.exit(0);
      }

      // 의사결정 키워드 패턴
      const decisionRe = /(?:도입했|폐기했|전환했|적용했|배포했|마이그레이션|변경했|합의했|결정했|도입합니다|폐기합니다|전환합니다|적용합니다|배포합니다|도입 완료|폐기 완료|전환 완료|적용 완료|배포 완료|표준화했|통합했|분리했|추가했|제거했|Phase \d+ 완료|설정을? 변경|규칙을? 변경|프로세스를? 변경|NON-NEGOTIABLE|신규 생성|전체 배포)/g;
      const kbRecordRe = /KB 기록:|semo kb upsert|KB upsert 완료|답변근거: KB/;

      interface DecisionCandidate {
        file: string;
        lineNum: number;
        text: string;
        keywords: string[];
        hasKbRecord: boolean;
        timestamp?: string;
      }

      const candidates: DecisionCandidate[] = [];

      for (const tPath of transcripts) {
        const lines = fs.readFileSync(tPath, "utf-8").split("\n").filter(l => l.trim());
        let lastKbUpsertLine = -1;

        for (let i = 0; i < lines.length; i++) {
          try {
            const entry = JSON.parse(lines[i]);
            const msg = entry.message ?? entry;

            // KB upsert tool call 추적
            if (msg.role === "assistant") {
              const content = msg.content ?? [];
              for (const block of content) {
                if (block?.type === "tool_use") {
                  const inp = JSON.stringify(block.input ?? {});
                  if (inp.includes("kb upsert") || inp.includes("kb_upsert")) {
                    lastKbUpsertLine = i;
                  }
                }
              }
            }

            // tool result에서 upsert 완료 추적
            if (msg.role === "tool") {
              const content = Array.isArray(msg.content)
                ? msg.content.map((c: any) => typeof c === "string" ? c : c?.text ?? "").join(" ")
                : String(msg.content ?? "");
              if (content.includes("upsert 완료")) {
                lastKbUpsertLine = i;
              }
            }

            // assistant 텍스트에서 의사결정 키워드 탐지
            if (msg.role === "assistant") {
              const content = msg.content ?? [];
              for (const block of content) {
                if (block?.type !== "text") continue;
                let text = block.text ?? "";

                // 코드 블록 제거
                text = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");

                const matches = text.match(decisionRe);
                if (matches && matches.length > 0) {
                  const hasKbInText = kbRecordRe.test(text);
                  // 같은 턴(±5줄 이내)에 KB upsert가 있었는지
                  const hasKbNearby = Math.abs(i - lastKbUpsertLine) <= 10;

                  candidates.push({
                    file: path.basename(tPath),
                    lineNum: i,
                    text: text.slice(0, 200).replace(/\n/g, " "),
                    keywords: [...new Set(matches)].slice(0, 3) as string[],
                    hasKbRecord: hasKbInText || hasKbNearby,
                    timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString("ko-KR") : undefined,
                  });
                }
              }
            }
          } catch { /* skip */ }
        }
      }

      // 미기록 건만 필터
      const unrecorded = candidates.filter(c => !c.hasKbRecord);
      const recorded = candidates.filter(c => c.hasKbRecord);

      if (options.format === "json") {
        const result = { total: candidates.length, recorded: recorded.length, unrecorded: unrecorded.length, items: unrecorded };
        const out = JSON.stringify(result, null, 2);
        if (options.output) {
          fs.writeFileSync(options.output, out);
          console.log(chalk.green(`✔ 결과 저장: ${options.output}`));
        } else {
          console.log(out);
        }
      } else {
        console.log(chalk.cyan.bold(`\n📋 세션 의사결정 다이제스트\n`));
        console.log(chalk.gray(`  transcript: ${transcripts.length}개 | 총 감지: ${candidates.length}건 | 기록됨: ${recorded.length}건 | 미기록: ${unrecorded.length}건\n`));

        if (unrecorded.length === 0) {
          console.log(chalk.green("  ✅ 미기록 의사결정 없음\n"));
        } else {
          console.log(chalk.yellow.bold("  ⚠ 미기록 의사결정:\n"));
          for (const c of unrecorded) {
            console.log(chalk.yellow(`  [${c.file}:${c.lineNum}]`) + chalk.gray(c.timestamp ? ` ${c.timestamp}` : ""));
            console.log(chalk.white(`    키워드: ${c.keywords.join(", ")}`));
            console.log(chalk.gray(`    "${c.text.slice(0, 120)}..."\n`));
          }
        }

        if (options.output) {
          const lines = [`# 세션 의사결정 다이제스트`, ``, `총 감지: ${candidates.length}건 | 기록됨: ${recorded.length}건 | 미기록: ${unrecorded.length}건`, ``];
          if (unrecorded.length > 0) {
            lines.push(`## 미기록 의사결정`, ``);
            for (const c of unrecorded) {
              lines.push(`- **[${c.file}:${c.lineNum}]** ${c.keywords.join(", ")}`);
              lines.push(`  > ${c.text.slice(0, 150)}...`);
              lines.push(``);
            }
          }
          fs.writeFileSync(options.output, lines.join("\n"));
          console.log(chalk.green(`✔ 결과 저장: ${options.output}`));
        }
      }
    });
}
