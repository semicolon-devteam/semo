/**
 * semo context — DB ↔ .claude/memory/ 동기화
 *
 * sync: Core DB → .claude/memory/*.md (KB domains, bot_status, ontology, projects)
 * push: .claude/memory/decisions.md → DB (semo.knowledge_base WHERE domain='decision')
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { getPool, closeConnection, isDbConnected } from "../database";
import { kbList, ontoList, OntologyDomain, KBEntry } from "../kb";

// ============================================================
// Memory file mapping
// ============================================================

const MEMORY_DIR = ".claude/memory";

// --out-dir 로 override 가능 (OpenClaw 봇 workspace 경로 지원)
function resolveMemoryDir(outDir?: string): string {
  if (outDir) {
    // 절대경로 또는 ~ 경로 처리
    return outDir.replace(/^~/, require("os").homedir());
  }
  return path.join(process.cwd(), MEMORY_DIR);
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

function kbEntriesToMarkdown(domain: string, entries: KBEntry[]): string {
  if (entries.length === 0) {
    return `# ${domain}\n\n_No entries._\n`;
  }

  const lines: string[] = [`# ${domain}\n`, `> 자동 생성: semo context sync (${new Date().toISOString()})\n`];

  for (const entry of entries) {
    lines.push(`\n## ${entry.key}\n`);
    lines.push(entry.content);
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      lines.push(`\n_metadata: ${JSON.stringify(entry.metadata)}_`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function botStatusToMarkdown(rows: BotStatusRow[]): string {
  if (rows.length === 0) {
    return "# Bots\n\n_No bot status data._\n";
  }

  const lines: string[] = [
    "# Bots\n",
    `> 자동 생성: semo context sync (${new Date().toISOString()})\n`,
    "| Bot | 이름 | 역할 | Status | Last Active | Sessions |",
    "|-----|------|------|--------|-------------|----------|",
  ];

  for (const bot of rows) {
    const status = bot.status === "online" ? "🟢 online" : "🔴 offline";
    const lastActive = bot.last_active ? new Date(bot.last_active).toLocaleString("ko-KR") : "-";
    const displayName = [bot.emoji, bot.name].filter(Boolean).join(" ") || bot.bot_id;
    lines.push(`| ${bot.bot_id} | ${displayName} | ${bot.role || "-"} | ${status} | ${lastActive} | ${bot.session_count} |`);
  }

  return lines.join("\n") + "\n";
}

function ontologyToMarkdown(domains: OntologyDomain[]): string {
  if (domains.length === 0) {
    return "# Ontology\n\n_No ontology domains._\n";
  }

  const lines: string[] = [
    "# Ontology\n",
    `> 자동 생성: semo context sync (${new Date().toISOString()})\n`,
  ];

  for (const d of domains) {
    lines.push(`\n## ${d.domain} (v${d.version})\n`);
    if (d.description) lines.push(`${d.description}\n`);
    lines.push("```json");
    lines.push(JSON.stringify(d.schema, null, 2));
    lines.push("```\n");
  }

  return lines.join("\n");
}

// ============================================================
// Bot Status types (for this module)
// ============================================================

interface BotStatusRow {
  bot_id: string;
  name: string | null;
  emoji: string | null;
  role: string | null;
  status: string | null;
  last_active: string | null;
  session_count: number;
}

async function fetchBotStatus(pool: Pool): Promise<BotStatusRow[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT bot_id, name, emoji, role, status, last_active::text, session_count
      FROM semo.bot_status
      ORDER BY bot_id
    `);
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

// ============================================================
// Markdown → KBEntry parser (for push)
// ============================================================

function parseDecisionsMarkdown(content: string): KBEntry[] {
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
        domain: "decision",
        key,
        content: body,
        created_by: "claude-context-push",
      });
    }
  }

  return entries;
}

// ============================================================
// Commands
// ============================================================

export function registerContextCommands(program: Command): void {
  const ctxCmd = program
    .command("context")
    .description("Core DB ↔ .claude/memory/ 컨텍스트 동기화");

  // ── semo context sync ──────────────────────────────────────
  ctxCmd
    .command("sync")
    .description("Core DB → .claude/memory/ 파일 생성")
    .option("--bot <name>", "봇 ID (bot_status 필터)")
    .option("--domain <name>", "특정 KB 도메인만")
    .option("--no-bots", "bot_status 동기화 건너뜀")
    .option("--no-ontology", "ontology 동기화 건너뜀")
    .option("--out-dir <path>", "메모리 파일 출력 경로 (기본: .claude/memory/). OpenClaw 봇 workspace 지원용")
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
      let written = 0;

      try {
        // 1. KB domains → memory/*.md
        const domains = options.domain ? [options.domain] : Object.keys(KB_DOMAIN_MAP);

        for (const domain of domains) {
          spinner.text = `KB 동기화: ${domain}...`;
          try {
            const { shared } = await kbList(pool, { domain, limit: 1000 });
            const filename = KB_DOMAIN_MAP[domain] || `${domain}.md`;
            const content = kbEntriesToMarkdown(domain, shared);
            fs.writeFileSync(path.join(memDir, filename), content);
            written++;
          } catch {
            // domain may not exist — skip silently
          }
        }

        // 2. bot_status → memory/bots.md
        if (options.bots !== false) {
          spinner.text = "bot_status 동기화...";
          const botRows = await fetchBotStatus(pool);
          const botsContent = botStatusToMarkdown(botRows);
          fs.writeFileSync(path.join(memDir, "bots.md"), botsContent);
          written++;
        }

        // 3. ontology → memory/ontology.md
        if (options.ontology !== false) {
          spinner.text = "ontology 동기화...";
          const domains2 = await ontoList(pool);
          const ontoContent = ontologyToMarkdown(domains2);
          fs.writeFileSync(path.join(memDir, "ontology.md"), ontoContent);
          written++;
        }

        spinner.succeed(`context sync 완료 — ${written}개 파일 업데이트`);
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
    .description(".claude/memory/decisions.md → Core DB (semo.knowledge_base)")
    .option("--domain <name>", "push할 도메인 (기본: decision)", "decision")
    .option("--dry-run", "실제 push 없이 변경사항만 미리보기")
    .option("--out-dir <path>", "메모리 파일 경로 (기본: .claude/memory/). OpenClaw 봇 workspace 지원용")
    .action(async (options) => {
      const memDir = resolveMemoryDir(options.outDir);

      const filename = KB_DOMAIN_MAP[options.domain] || `${options.domain}.md`;
      const filePath = path.join(memDir, filename);

      if (!fs.existsSync(filePath)) {
        console.log(chalk.red(`\n❌ 파일 없음: ${MEMORY_DIR}/${filename}`));
        console.log(chalk.gray("  semo context sync 먼저 실행하세요."));
        process.exit(1);
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const entries = parseDecisionsMarkdown(content);

      if (entries.length === 0) {
        console.log(chalk.yellow("⚠️  push할 항목이 없습니다."));
        return;
      }

      console.log(chalk.cyan(`\n📤 context push: ${options.domain} (${entries.length}건)\n`));

      if (options.dryRun) {
        for (const e of entries) {
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
        for (const entry of entries) {
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
