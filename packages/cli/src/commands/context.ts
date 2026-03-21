/**
 * semo context — 스킬/캐시/크론잡 동기화
 *
 * sync: DB → 글로벌 캐시 (skills/commands/agents) + 스킬 DB 동기화 + 크론잡
 * push: .claude/memory/<domain>.md → DB (deprecated — kb_upsert MCP 도구로 대체)
 *
 * [v4.2.0] KB→md 파일 생성 제거 — semo-kb MCP 서버로 통일
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Pool } from "pg";
import { getPool, closeConnection, isDbConnected } from "../database";
import { KBEntry } from "../kb";
import { syncSkillsToDB } from "./skill-sync";
import { syncGlobalCache } from "../global-cache";

// ============================================================
// Memory file mapping
// ============================================================

const MEMORY_DIR = ".claude/memory";

// --out-dir 로 override 가능 (OpenClaw 봇 workspace 경로 지원)
// 기본값: ~/.claude/memory/ (글로벌 — 모든 프로젝트에서 공유)
function resolveMemoryDir(outDir?: string): string {
  if (outDir) {
    // 절대경로 또는 ~ 경로 처리
    return outDir.replace(/^~/, require("os").homedir());
  }
  return path.join(require("os").homedir(), MEMORY_DIR);
}

const KB_DOMAIN_MAP: Record<string, string> = {
  team: "team.md",
  project: "projects.md",
  decision: "decisions.md",
  infra: "infra.md",
  process: "process.md",
};

// ============================================================
// Helpers
// ============================================================

function ensureMemoryDir(resolvedDir: string): string {
  fs.mkdirSync(resolvedDir, { recursive: true });
  return resolvedDir;
}

// [v4.2.0] KB→md 헬퍼 함수 제거 — semo-kb MCP 서버로 대체
// kbEntriesToMarkdown, botStatusToMarkdown, ontologyToMarkdown, fetchBotStatus 삭제됨

// ============================================================
// Cron job sync (local ~/.openclaw-*/cron/jobs.json → DB)
// ============================================================

interface CronJob {
  jobId: string;
  name: string;
  schedule: Record<string, unknown>;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  sessionTarget: string;
  payload: Record<string, unknown> | null;
}

function parseCronJobsFile(filePath: string): CronJob[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    const jobs: unknown[] = data.jobs || [];
    return jobs.map((job: any) => ({
      jobId: job.jobId || job.id,
      name: job.name || "",
      schedule: job.schedule || {},
      enabled: job.enabled !== false,
      lastRun: job.lastRun || null,
      nextRun: job.nextRun || null,
      sessionTarget: job.sessionTarget || "main",
      payload: job.payload || null,
    }));
  } catch {
    return [];
  }
}

function getOpenClawBotIds(): string[] {
  const homeDir = os.homedir();
  try {
    return fs.readdirSync(homeDir)
      .filter(f => f.startsWith(".openclaw-"))
      .map(f => f.replace(".openclaw-", ""));
  } catch {
    return [];
  }
}

/**
 * Collect cron jobs from all ~/.openclaw-* directories and upsert to semo.bot_cron_jobs.
 * Uses DELETE + INSERT per bot (same pattern as sync-agent).
 */
export async function syncCronJobs(pool: Pool): Promise<{ bots: number; jobs: number }> {
  const homeDir = os.homedir();
  const botIds = getOpenClawBotIds();
  let totalJobs = 0;
  let syncedBots = 0;

  const client = await pool.connect();
  try {
    for (const botId of botIds) {
      const cronPath = path.join(homeDir, `.openclaw-${botId}`, "cron", "jobs.json");
      const jobs = parseCronJobsFile(cronPath);

      // Always delete old entries (handles removed jobs)
      await client.query("DELETE FROM semo.bot_cron_jobs WHERE bot_id = $1", [botId]);

      for (const job of jobs) {
        await client.query(
          `INSERT INTO semo.bot_cron_jobs
             (bot_id, job_id, name, schedule, enabled, last_run, next_run, session_target, payload, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            botId,
            job.jobId,
            job.name,
            JSON.stringify(job.schedule),
            job.enabled,
            job.lastRun,
            job.nextRun,
            job.sessionTarget,
            job.payload ? JSON.stringify(job.payload) : null,
          ]
        );
      }

      totalJobs += jobs.length;
      if (jobs.length > 0) syncedBots++;
    }
  } finally {
    client.release();
  }

  return { bots: syncedBots, jobs: totalJobs };
}

// ============================================================
// Markdown → KBEntry parser (for push)
// ============================================================

function parseMarkdownSections(content: string, domain: string): KBEntry[] {
  const entries: KBEntry[] = [];

  // Split by h2 sections
  const sections = content.split(/\n##\s+/);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const firstNewline = section.indexOf("\n");
    if (firstNewline === -1) continue;

    const key = section.substring(0, firstNewline).trim();
    const body = section.substring(firstNewline + 1).trim();

    if (key && body) {
      entries.push({
        domain,
        key,
        content: body,
        created_by: "claude-context-push",
      });
    }
  }

  return entries;
}

// [v4.2.0] digestToMarkdown 제거 — MCP kb_digest로 대체

// ============================================================
// Commands
// ============================================================

export function registerContextCommands(program: Command): void {
  const ctxCmd = program
    .command("context")
    .description("스킬/캐시/크론잡 동기화 (KB는 semo-kb MCP 서버)");

  // ── semo context sync ──────────────────────────────────────
  ctxCmd
    .command("sync")
    .description("스킬/에이전트/캐시 동기화 + 크론잡 (KB는 semo-kb MCP 서버 사용)")
    .option("--no-skills", "스킬 파일 → DB 동기화 건너뜀")
    .option("--out-dir <path>", "캐시 파일 출력 경로 (기본: .claude/memory/)")
    .option("--no-global-cache", "글로벌 캐시(skills/commands/agents) 동기화 건너뜀")
    .action(async (options) => {
      const spinner = ora("context sync 시작...").start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.warn("DB 연결 실패 — context sync 건너뜀");
        await closeConnection();
        return;
      }

      const pool = getPool();
      const memDir = ensureMemoryDir(resolveMemoryDir(options.outDir));

      try {
        // [v4.2.0] KB→md 파일 생성 제거 — MCP kb_search/kb_list/kb_bot_status/kb_ontology로 대체
        // 기존 memory/*.md (team, projects, decisions, infra, process, bots, ontology) 파일은
        // semo-kb MCP 서버가 실시간 DB 조회로 대체합니다.

        // 1. 스킬 파일 → skill_definitions DB 동기화
        if (options.skills !== false) {
          const semoSystemDir = path.join(process.cwd(), "semo-system");
          if (fs.existsSync(semoSystemDir)) {
            spinner.text = "skills 동기화...";
            const client = await pool.connect();
            try {
              await client.query("BEGIN");
              await syncSkillsToDB(client, semoSystemDir);
              await client.query("COMMIT");
            } catch {
              await client.query("ROLLBACK").catch(() => {});
              // 스킬 동기화 실패는 무시 — context sync의 핵심은 memory/ 파일
            } finally {
              client.release();
            }
          }
        }

        // 2. DB → 글로벌 캐시 (skills/commands/agents → ~/.claude/)
        if (options.globalCache !== false) {
          spinner.text = "글로벌 캐시 동기화 (skills/commands/agents)...";
          try {
            const cacheResult = await syncGlobalCache();
            console.log(chalk.green(`  ✓ 글로벌 캐시: skills(${cacheResult.skills}) commands(${cacheResult.commands}) agents(${cacheResult.agents})`));
          } catch (cacheErr) {
            // DB 실패 시 기존 파일 유지 (비치명적)
            console.log(chalk.yellow(`  ⚠ 글로벌 캐시 동기화 실패 (기존 파일 유지): ${cacheErr}`));
          }
        }

        // 3. 크론잡 동기화 (local → DB)
        try {
          spinner.text = "크론잡 동기화...";
          const cronResult = await syncCronJobs(pool);
          if (cronResult.jobs > 0) {
            console.log(chalk.green(`  ✓ 크론잡: ${cronResult.bots}개 봇, ${cronResult.jobs}개 잡 동기화`));
          }
        } catch {
          // 크론잡 동기화 실패는 비치명적
        }

        // [v4.2.0] KB Digest 제거 — MCP kb_digest로 대체

        // 4. MCP 서버 자동 등록 (.claude/settings.json)
        try {
          const semoRoot = process.cwd();
          const settingsPath = path.join(memDir, "..", "settings.json");
          if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
            if (!settings.mcpServers?.["semo-kb"]) {
              settings.mcpServers = settings.mcpServers || {};
              settings.mcpServers["semo-kb"] = {
                command: "node",
                args: [path.join(semoRoot, "packages/mcp-kb/dist/index.js")],
              };
              fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
              console.log(chalk.green("  ✓ semo-kb MCP 서버 자동 등록"));
            }
          }
        } catch {
          // MCP 자동 등록 실패는 비치명적
        }

        spinner.succeed("context sync 완료 — 스킬/캐시/크론잡 동기화");
        console.log(chalk.gray(`  저장 위치: ${memDir}`));
      } catch (err) {
        spinner.fail(`context sync 실패: ${err}`);
      } finally {
        await closeConnection();
      }
    });

  // ── semo context push ──────────────────────────────────────
  ctxCmd
    .command("push")
    .description(".claude/memory/<domain>.md → Core DB (semo.knowledge_base)")
    .option("--domain <name>", "push할 도메인 (쉼표 구분 가능, 기본: decision)", "decision")
    .option("--dry-run", "실제 push 없이 변경사항만 미리보기")
    .option("--out-dir <path>", "메모리 파일 경로 (기본: .claude/memory/). OpenClaw 봇 workspace 지원용")
    .action(async (options) => {
      console.log(chalk.yellow("⚠️  [deprecated] context push는 kb_upsert MCP 도구로 대체 예정입니다."));
      console.log(chalk.yellow("   봇/세션에서는 semo-kb MCP 서버의 kb_upsert 도구를 직접 사용하세요.\n"));

      const domains: string[] = (options.domain as string).split(",").map((d: string) => d.trim()).filter(Boolean);
      const memDir = resolveMemoryDir(options.outDir);

      // 각 도메인별 엔트리 수집
      const allEntries: KBEntry[] = [];
      for (const domain of domains) {
        const filename = KB_DOMAIN_MAP[domain] || `${domain}.md`;
        const filePath = path.join(memDir, filename);

        if (!fs.existsSync(filePath)) {
          console.log(chalk.yellow(`⚠️  파일 없음 (건너뜀): ${MEMORY_DIR}/${filename}`));
          continue;
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const entries = parseMarkdownSections(content, domain);
        allEntries.push(...entries);
      }

      if (allEntries.length === 0) {
        console.log(chalk.yellow("⚠️  push할 항목이 없습니다."));
        return;
      }

      console.log(chalk.cyan(`\n📤 context push: ${domains.join(", ")} (${allEntries.length}건)\n`));

      if (options.dryRun) {
        for (const e of allEntries) {
          console.log(chalk.gray(`  [dry-run] ${e.domain}/${e.key}`));
        }
        return;
      }

      const spinner = ora("DB에 업로드 중...").start();

      const connected = await isDbConnected();
      if (!connected) {
        spinner.fail("DB 연결 실패");
        process.exit(1);
      }

      const pool = getPool();
      const client = await pool.connect();
      let upserted = 0;
      const errors: string[] = [];

      try {
        await client.query("BEGIN");
        for (const entry of allEntries) {
          try {
            await client.query(
              `INSERT INTO semo.knowledge_base (domain, key, content, metadata, created_by)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (domain, key) DO UPDATE SET
                 content = EXCLUDED.content,
                 metadata = EXCLUDED.metadata`,
              [entry.domain, entry.key, entry.content, JSON.stringify(entry.metadata || {}), entry.created_by]
            );
            upserted++;
          } catch (err) {
            errors.push(`${entry.domain}/${entry.key}: ${err}`);
          }
        }
        await client.query("COMMIT");

        spinner.succeed(`push 완료: ${upserted}건 업서트`);
        if (errors.length > 0) {
          errors.forEach(e => console.log(chalk.red(`  ❌ ${e}`)));
        }
      } catch (err) {
        await client.query("ROLLBACK");
        spinner.fail(`push 실패: ${err}`);
      } finally {
        client.release();
        await closeConnection();
      }
    });
}
