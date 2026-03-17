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
import { auditBot, auditBotDb, mergeDbChecks, fixBot, storeAuditResults, formatAuditSlack, BotAuditResult } from "./audit";
import { syncSkillsToDB, scanSkills } from "./skill-sync";

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
// Seed types
// ============================================================

interface SeedSkill {
  name: string;
  prompt: string;
  package: string;
  botId: string | null;
}

interface SeedAgent {
  botId: string;
  name: string;
  emoji: string | null;
  role: string;
  personaPrompt: string;
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

        // Audit piggyback — sync 후 자동 audit 실행
        try {
          console.log(chalk.gray("  → audit 실행 중..."));
          const auditResults = bots.map(b => auditBot(b.workspacePath, b.botId));
          const auditClient = await pool.connect();
          await storeAuditResults(auditResults, auditClient);
          auditClient.release();
          const good = auditResults.filter(r => r.rating === "GOOD").length;
          console.log(chalk.green(`  → audit 완료: ${auditResults.length}개 봇 (GOOD: ${good})`));
        } catch {
          console.log(chalk.yellow("  ⚠ audit 저장 실패 (무시)"));
        }

        // Skills piggyback — 스킬 파일 → skill_definitions 동기화
        try {
          console.log(chalk.gray("  → skills sync 실행 중..."));
          const skillClient = await pool.connect();
          try {
            await skillClient.query("BEGIN");
            const result = await syncSkillsToDB(skillClient, semoSystemDir);
            await skillClient.query("COMMIT");
            console.log(chalk.green(`  → skills sync 완료: ${result.total}개 (공유: ${result.shared}, 봇 전용: ${result.botSpecific})`));
          } finally {
            skillClient.release();
          }
        } catch {
          console.log(chalk.yellow("  ⚠ skills sync 실패 (무시)"));
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

  // ── semo bots audit ───────────────────────────────────────────
  botsCmd
    .command("audit")
    .description("봇 워크스페이스 표준 구조 audit")
    .option("--format <type>", "출력 형식 (table|json|slack)", "table")
    .option("--fix", "누락 파일/디렉토리 자동 생성")
    .option("--no-db", "DB 저장 건너뛰기")
    .option("--semo-system <path>", "semo-system 경로 (기본: ./semo-system)")
    .action(async (options) => {
      const cwd = process.cwd();
      const semoSystemDir = options.semoSystem
        ? path.resolve(options.semoSystem)
        : path.join(cwd, "semo-system");

      const workspacesDir = path.join(semoSystemDir, "bot-workspaces");
      if (!fs.existsSync(workspacesDir)) {
        console.log(chalk.red(`\n❌ bot-workspaces 디렉토리를 찾을 수 없습니다: ${workspacesDir}`));
        process.exit(1);
      }

      const spinner = ora("bot-workspaces audit 중...").start();

      // Scan bot directories
      const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
      const botDirs = entries.filter(e => e.isDirectory());

      if (botDirs.length === 0) {
        spinner.warn("봇 워크스페이스가 없습니다.");
        return;
      }

      // Run audit
      const results: BotAuditResult[] = botDirs.map(e => {
        const botDir = path.join(workspacesDir, e.name);
        return auditBot(botDir, e.name);
      });

      spinner.stop();

      // --fix
      if (options.fix) {
        let totalFixed = 0;
        for (const r of results) {
          const botDir = path.join(workspacesDir, r.botId);
          const fixed = fixBot(botDir, r.botId, r.checks);
          if (fixed > 0) {
            console.log(chalk.green(`  ✔ ${r.botId}: ${fixed}개 파일/디렉토리 생성`));
            totalFixed += fixed;
          }
        }
        if (totalFixed > 0) {
          console.log(chalk.green(`\n총 ${totalFixed}개 수정`));
          // Re-audit after fix
          for (let i = 0; i < results.length; i++) {
            const botDir = path.join(workspacesDir, results[i].botId);
            results[i] = auditBot(botDir, results[i].botId);
          }
        }
      }

      // DB sync checks + store
      if (options.db !== false) {
        const connected = await isDbConnected();
        if (connected) {
          const pool = getPool();

          // Merge DB sync checks into results
          try {
            for (let i = 0; i < results.length; i++) {
              const dbChecks = await auditBotDb(results[i].botId, pool);
              results[i] = mergeDbChecks(results[i], dbChecks);
            }
          } catch (err) {
            console.log(chalk.yellow(`  ⚠ DB sync 체크 실패: ${err}`));
          }

          // Store results (separate try — table may not exist yet)
          try {
            const client = await pool.connect();
            try {
              await storeAuditResults(results, client);
            } finally {
              client.release();
            }
          } catch {
            // bot_workspace_audits table may not exist — silent skip
          }

          await closeConnection();
        } else {
          await closeConnection();
        }
      }

      // Output
      if (options.format === "json") {
        console.log(JSON.stringify(results, null, 2));
      } else if (options.format === "slack") {
        console.log(formatAuditSlack(results));
      } else {
        console.log(chalk.cyan.bold("\n🔍 Bot Workspace Audit\n"));
        console.log(chalk.gray("  봇              Score  Rating       Passed"));
        console.log(chalk.gray("  " + "─".repeat(55)));

        for (const r of results) {
          const ratingColor =
            r.rating === "GOOD" ? chalk.green :
            r.rating === "NEEDS-WORK" ? chalk.yellow :
            chalk.red;
          const passed = r.checks.filter(c => c.passed).length;
          console.log(
            `  ${r.botId.padEnd(16)}${String(r.score).padStart(3)}%   ${ratingColor(r.rating.padEnd(12))} ${passed}/${r.checks.length}`
          );
        }

        const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
        const good = results.filter(r => r.rating === "GOOD").length;
        console.log(chalk.gray(`\n  ${results.length}개 봇, 평균 ${avgScore}%, GOOD: ${good}개\n`));
      }
    });

  // ── semo bots seed ──────────────────────────────────────────
  botsCmd
    .command("seed")
    .description("semo-skills + bot-workspaces → skill_definitions / agent_definitions 시딩")
    .option("--semo-system <path>", "semo-system 경로 (기본: ./semo-system)")
    .option("--reset", "시딩 전 기존 데이터 삭제")
    .option("--dry-run", "실제 DB 반영 없이 미리보기")
    .action(async (options) => {
      const cwd = process.cwd();
      const semoSystemDir = options.semoSystem
        ? path.resolve(options.semoSystem)
        : path.join(cwd, "semo-system");

      if (!fs.existsSync(semoSystemDir)) {
        console.log(chalk.red(`\n❌ semo-system 디렉토리를 찾을 수 없습니다: ${semoSystemDir}`));
        process.exit(1);
      }

      const spinner = ora("스킬/에이전트 스캔 중...").start();

      // ─── 1+2. 스킬 스캔 (공통 모듈) ─────────────────────────
      const { shared: sharedSkills, botSpecific: botSkills } = scanSkills(semoSystemDir);

      // ─── 3. 에이전트 스캔 ─────────────────────────────────
      const workspacesDir = path.join(semoSystemDir, "bot-workspaces");
      const agents: SeedAgent[] = [];

      if (fs.existsSync(workspacesDir)) {
        const botEntries = fs.readdirSync(workspacesDir, { withFileTypes: true });
        for (const botEntry of botEntries) {
          if (!botEntry.isDirectory()) continue;
          const botDir = path.join(workspacesDir, botEntry.name);
          const identityPath = path.join(botDir, "IDENTITY.md");
          if (!fs.existsSync(identityPath)) continue;

          try {
            const identity = parseIdentityMd(fs.readFileSync(identityPath, "utf-8"));

            // persona_prompt = SOUL.md + \n\n---\n\n + AGENTS.md
            const parts: string[] = [];
            const soulPath = path.join(botDir, "SOUL.md");
            if (fs.existsSync(soulPath)) {
              parts.push(fs.readFileSync(soulPath, "utf-8"));
            }
            const agentsPath = path.join(botDir, "AGENTS.md");
            if (fs.existsSync(agentsPath)) {
              parts.push(fs.readFileSync(agentsPath, "utf-8"));
            }
            const personaPrompt = parts.join("\n\n---\n\n");

            agents.push({
              botId: botEntry.name,
              name: identity.name || botEntry.name,
              emoji: identity.emoji,
              role: (identity.role || "custom").substring(0, 50),
              personaPrompt,
            });
          } catch { /* skip */ }
        }
      }

      spinner.stop();

      // ─── 미리보기 출력 ─────────────────────────────────────
      console.log(chalk.cyan.bold("\n📦 Seed 스캔 결과\n"));
      console.log(chalk.white(`  공유 스킬 (semo-skills):  ${sharedSkills.length}개`));
      console.log(chalk.white(`  봇 전용 스킬 (openclaw):  ${botSkills.length}개`));
      console.log(chalk.white(`  에이전트 (봇):            ${agents.length}개`));

      console.log(chalk.white(`  예상 target_agents 설정:  ${botSkills.length}개 (봇 전용)`));

      if (agents.length > 0) {
        console.log(chalk.gray("\n  에이전트:"));
        for (const a of agents) {
          const ownSkills = botSkills.filter(s => s.botId === a.botId);
          console.log(
            chalk.gray(`    ${a.emoji || "?"} ${a.botId.padEnd(14)}`) +
            chalk.white(`${a.role}`.substring(0, 40).padEnd(42)) +
            chalk.gray(`전용 스킬: ${ownSkills.length}`)
          );
        }
      }

      if (options.dryRun) {
        console.log(chalk.yellow("\n  [dry-run] DB 반영 없이 종료\n"));
        return;
      }

      // ─── DB 반영 ──────────────────────────────────────────
      const spinnerDb = ora("DB 반영 중...").start();

      const connected = await isDbConnected();
      if (!connected) {
        spinnerDb.fail("DB 연결 실패");
        await closeConnection();
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // --reset: 기존 데이터 삭제
        if (options.reset) {
          spinnerDb.text = "기존 데이터 삭제 중...";
          await client.query("DELETE FROM agent_definitions");
          await client.query("DELETE FROM skill_definitions WHERE office_id IS NULL");
        }

        // ─── 스킬 시딩 (공통 모듈) ──────────────────────────
        spinnerDb.text = `스킬 ${sharedSkills.length + botSkills.length}개 시딩 중...`;
        await syncSkillsToDB(client, semoSystemDir);

        // ─── 에이전트 시딩 ───────────────────────────────────
        spinnerDb.text = `에이전트 ${agents.length}개 시딩 중...`;
        for (const agent of agents) {
          await client.query(
            `INSERT INTO agent_definitions (name, role, persona_prompt, package, avatar_config, is_active, office_id)
             VALUES ($1, $2, $3, 'openclaw', $4, true, NULL)
             ON CONFLICT (name, office_id) DO UPDATE SET
               role = EXCLUDED.role,
               persona_prompt = EXCLUDED.persona_prompt,
               avatar_config = EXCLUDED.avatar_config,
               updated_at = NOW()`,
            [
              agent.botId,
              agent.role,
              agent.personaPrompt,
              JSON.stringify({ emoji: agent.emoji }),
            ]
          );
        }

        await client.query("COMMIT");
        spinnerDb.succeed("seed 완료");

        console.log(chalk.green(`  ✔ 공유 스킬: ${sharedSkills.length}개 (target_agents: {all})`));
        console.log(chalk.green(`  ✔ 봇 전용 스킬: ${botSkills.length}개 (target_agents: 봇명)`));
        console.log(chalk.green(`  ✔ 에이전트: ${agents.length}개`));
        console.log();
      } catch (err) {
        await client.query("ROLLBACK");
        spinnerDb.fail(`seed 실패: ${err}`);
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
