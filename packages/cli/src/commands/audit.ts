/**
 * Bot Workspace Audit — v2.0 표준 구조 compliance 감사
 *
 * v2.0 규격 기준:
 *   - 필수 파일: SOUL.md, AGENTS.md (심링크), USER.md, MEMORY.md
 *   - 필수 디렉토리: .claude/, hooks/, memory/, skills/
 *   - 레거시 파일 부재 확인: IDENTITY.md, TOOLS.md, RULES.md
 *   - MEMORY.md slim check (< 30줄)
 *   - KB 도메인 존재 확인
 *
 * --fix 옵션으로 누락 파일/디렉토리 자동 생성 가능.
 * 레거시 파일은 --fix로 생성하지 않음 (v1→v2 전환 완료).
 */

import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient } from "pg";
import { randomUUID } from "crypto";

// ============================================================
// Types
// ============================================================

export interface AuditCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface BotAuditResult {
  botId: string;
  rating: "GOOD" | "NEEDS-WORK" | "POOR";
  score: number;
  checks: AuditCheck[];
}

// ============================================================
// Check definitions (v2.0)
// ============================================================

interface CheckDef {
  name: string;
  check: (botDir: string, botId: string) => AuditCheck;
}

function fileExistsCheck(name: string, relativePath: string): CheckDef {
  return {
    name,
    check: (botDir) => {
      const fullPath = path.join(botDir, relativePath);
      const exists = fs.existsSync(fullPath);
      return {
        name,
        passed: exists,
        detail: exists ? `${relativePath} exists` : `${relativePath} missing`,
      };
    },
  };
}

function fileAbsentCheck(name: string, relativePath: string): CheckDef {
  return {
    name,
    check: (botDir) => {
      const fullPath = path.join(botDir, relativePath);
      const exists = fs.existsSync(fullPath);
      return {
        name,
        passed: !exists,
        detail: exists
          ? `${relativePath} 레거시 파일 존재 (삭제 필요)`
          : `${relativePath} 없음 (정상)`,
      };
    },
  };
}

function dirExistsCheck(name: string, relativePath: string): CheckDef {
  return {
    name,
    check: (botDir) => {
      const fullPath = path.join(botDir, relativePath);
      const exists =
        fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      return {
        name,
        passed: exists,
        detail: exists
          ? `${relativePath}/ exists`
          : `${relativePath}/ missing`,
      };
    },
  };
}

function memorySlimCheck(): CheckDef {
  return {
    name: "memory/slim",
    check: (botDir) => {
      const memoryPath = path.join(botDir, "MEMORY.md");
      if (!fs.existsSync(memoryPath)) {
        return { name: "memory/slim", passed: true, detail: "MEMORY.md not present (N/A)" };
      }
      const lines = fs.readFileSync(memoryPath, "utf-8").split("\n").length;
      const passed = lines <= 30;
      return {
        name: "memory/slim",
        passed,
        detail: passed
          ? `MEMORY.md is ${lines} lines (≤ 30)`
          : `MEMORY.md is ${lines} lines (> 30, bloated)`,
      };
    },
  };
}

function symlinkCheck(name: string, relativePath: string, expectedTarget: string): CheckDef {
  return {
    name,
    check: (botDir) => {
      const fullPath = path.join(botDir, relativePath);
      if (!fs.existsSync(fullPath)) {
        return { name, passed: false, detail: `${relativePath} 없음` };
      }
      const stats = fs.lstatSync(fullPath);
      if (!stats.isSymbolicLink()) {
        return { name, passed: false, detail: `${relativePath} 심링크 아님 (일반 파일)` };
      }
      const target = fs.readlinkSync(fullPath);
      const isCorrect = target === expectedTarget;
      return {
        name,
        passed: isCorrect,
        detail: isCorrect
          ? `${relativePath} → ${expectedTarget} (정상)`
          : `${relativePath} → ${target} (기대: ${expectedTarget})`,
      };
    },
  };
}

const SHARED_AGENTS_PATH = path.join(
  process.env.HOME || "/Users/reus",
  ".openclaw-shared",
  "AGENTS.md"
);

const CHECK_DEFS: CheckDef[] = [
  // v2.0 필수 파일
  fileExistsCheck("root/SOUL.md", "SOUL.md"),
  fileExistsCheck("root/AGENTS.md", "AGENTS.md"),
  symlinkCheck("root/AGENTS.md-symlink", "AGENTS.md", SHARED_AGENTS_PATH),
  fileExistsCheck("root/USER.md", "USER.md"),
  fileExistsCheck("root/MEMORY.md", "MEMORY.md"),
  // v2.0 필수 디렉토리
  dirExistsCheck(".claude/", ".claude"),
  dirExistsCheck("hooks/", "hooks"),
  dirExistsCheck("memory/", "memory"),
  dirExistsCheck("skills/", "skills"),
  // Memory slim
  memorySlimCheck(),
  // v2.0 레거시 파일 부재 확인
  fileAbsentCheck("legacy/IDENTITY.md", "IDENTITY.md"),
  fileAbsentCheck("legacy/TOOLS.md", "TOOLS.md"),
  fileAbsentCheck("legacy/RULES.md", "RULES.md"),
];

// ============================================================
// DB-based rule loading
// ============================================================

interface WorkspaceStandardRow {
  path_pattern: string;
  entry_type: string;
  level: string;
  severity: string;
  category: string;
  bot_scope: string;
  bot_ids: string[];
  symlink_target: string | null;
  content_rules: Record<string, unknown> | null;
  description: string | null;
  fix_action: string | null;
  fix_template: string | null;
}

function buildChecksFromRow(row: WorkspaceStandardRow): CheckDef[] {
  const defs: CheckDef[] = [];
  const name = `${row.category}/${row.path_pattern}`;

  if (row.level === "required") {
    if (row.entry_type === "symlink") {
      const target = row.symlink_target?.replace("$HOME", process.env.HOME || "/Users/reus") || "";
      defs.push(symlinkCheck(`${name}-symlink`, row.path_pattern, target));
      defs.push(fileExistsCheck(name, row.path_pattern));
    } else if (row.entry_type === "dir") {
      const dirPath = row.path_pattern.endsWith("/")
        ? row.path_pattern.slice(0, -1)
        : row.path_pattern;
      defs.push(dirExistsCheck(name, dirPath));
    } else {
      defs.push(fileExistsCheck(name, row.path_pattern));
    }
  } else if (row.level === "forbidden") {
    if (row.entry_type === "glob") {
      // Glob forbidden checks require special handling — skip for basic audit
      // (covered by hygiene checks in shell scripts)
    } else {
      defs.push(fileAbsentCheck(name, row.path_pattern.replace(/\/$/, "")));
    }
  }

  // Content rules: line count check
  if (row.content_rules && typeof row.content_rules === "object") {
    const rules = row.content_rules as Record<string, unknown>;
    const maxLines = rules.max_lines as number | undefined;
    if (maxLines && row.entry_type !== "dir") {
      defs.push({
        name: `${name}/lines`,
        check: (botDir) => {
          const fullPath = path.join(botDir, row.path_pattern);
          if (!fs.existsSync(fullPath)) {
            return { name: `${name}/lines`, passed: true, detail: `${row.path_pattern} not present (N/A)` };
          }
          const lines = fs.readFileSync(fullPath, "utf-8").split("\n").length;
          const passed = lines <= maxLines;
          return {
            name: `${name}/lines`,
            passed,
            detail: passed
              ? `${row.path_pattern} is ${lines} lines (≤ ${maxLines})`
              : `${row.path_pattern} is ${lines} lines (> ${maxLines}, bloated)`,
          };
        },
      });
    }
  }

  return defs;
}

function botMatchesRow(row: WorkspaceStandardRow, botId: string): boolean {
  if (row.bot_scope === "all") return true;
  if (row.bot_scope === "include") return row.bot_ids.includes(botId);
  if (row.bot_scope === "exclude") return !row.bot_ids.includes(botId);
  return true;
}

async function loadCheckDefs(pool: Pool): Promise<{ defs: CheckDef[]; rows: WorkspaceStandardRow[] }> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT path_pattern, entry_type, level, severity, category,
              bot_scope, bot_ids, symlink_target, content_rules,
              description, fix_action, fix_template
       FROM semo.bot_workspace_standard
       WHERE spec_version = '2.0'
       ORDER BY level, path_pattern`,
    );
    const rows: WorkspaceStandardRow[] = result.rows;
    const defs: CheckDef[] = [];
    for (const row of rows) {
      defs.push(...buildChecksFromRow(row));
    }
    return { defs, rows };
  } finally {
    client.release();
  }
}

function buildCheckDefsForBot(
  allDefs: CheckDef[],
  allRows: WorkspaceStandardRow[],
  botId: string,
): CheckDef[] {
  // Filter defs based on bot_scope. Map row index to defs.
  const filtered: CheckDef[] = [];
  let defIdx = 0;
  for (const row of allRows) {
    const rowDefs = buildChecksFromRow(row);
    if (botMatchesRow(row, botId)) {
      filtered.push(...rowDefs);
    }
    defIdx += rowDefs.length;
  }
  return filtered;
}

// ============================================================
// Core audit function
// ============================================================

/** Sync version using fallback CHECK_DEFS (no DB) */
export function auditBot(botDir: string, botId: string): BotAuditResult {
  const checks = CHECK_DEFS.map((def) => def.check(botDir, botId));
  return computeRating(botId, checks);
}

/** Async version using DB-loaded rules */
export async function auditBotFromDb(
  botDir: string,
  botId: string,
  pool: Pool,
): Promise<BotAuditResult> {
  try {
    const { rows } = await loadCheckDefs(pool);
    const defs = buildCheckDefsForBot([], rows, botId);
    if (defs.length === 0) {
      // Fallback if DB returns nothing
      return auditBot(botDir, botId);
    }
    const checks = defs.map((def) => def.check(botDir, botId));
    return computeRating(botId, checks);
  } catch {
    // Offline fallback
    return auditBot(botDir, botId);
  }
}

function computeRating(botId: string, checks: AuditCheck[]): BotAuditResult {
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  const memorySlim = checks.find((c) => c.name.includes("/lines") && c.name.includes("MEMORY"));
  const isMemorySlim = memorySlim ? memorySlim.passed : true;

  let rating: BotAuditResult["rating"];
  if (score >= 80 && isMemorySlim) {
    rating = "GOOD";
  } else if (score >= 50) {
    rating = "NEEDS-WORK";
  } else {
    rating = "POOR";
  }

  return { botId, rating, score, checks };
}

// ============================================================
// Auto-fix (v2.0 — 레거시 파일은 생성하지 않음)
// ============================================================

const FIXABLE_FILES: Record<string, string> = {
  "root/SOUL.md": "SOUL.md",
  "root/USER.md": "USER.md",
  "root/MEMORY.md": "MEMORY.md",
};

const FIXABLE_DIRS: Record<string, string> = {
  ".claude/": ".claude",
  "hooks/": "hooks",
  "memory/": "memory",
  "skills/": "skills",
};

const FILE_TEMPLATES: Record<string, (botId: string) => string> = {
  "SOUL.md": (botId) =>
    `# ${botId} — SOUL\n\n## Identity\n\n> TODO\n\n## R&R\n\n> TODO\n\n## KB Lookup Protocol\n\n> kb_get/kb_search로 팀 정보 조회\n\n## Operating Procedures\n\n> TODO\n\n## NON-NEGOTIABLE\n\n1. TODO\n`,
};

export function fixBot(
  botDir: string,
  botId: string,
  checks: AuditCheck[]
): number {
  let fixed = 0;

  for (const check of checks) {
    if (check.passed) continue;

    // Fix missing files (v2.0 허용 파일만)
    if (FIXABLE_FILES[check.name]) {
      const relPath = FIXABLE_FILES[check.name];
      const fullPath = path.join(botDir, relPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filename = path.basename(relPath);
      const templateFn = FILE_TEMPLATES[relPath];
      const content = templateFn
        ? templateFn(botId)
        : `# ${filename}\n\n> TODO: ${botId}\n`;
      fs.writeFileSync(fullPath, content, "utf-8");
      fixed++;
    }

    // Fix missing directories
    if (FIXABLE_DIRS[check.name]) {
      const relPath = FIXABLE_DIRS[check.name];
      const fullPath = path.join(botDir, relPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        fixed++;
      }
    }

    // Fix AGENTS.md symlink
    if (check.name === "root/AGENTS.md" || check.name === "root/AGENTS.md-symlink") {
      const agentsPath = path.join(botDir, "AGENTS.md");
      if (fs.existsSync(SHARED_AGENTS_PATH)) {
        // 기존 일반 파일이면 삭제 후 심링크 생성
        if (fs.existsSync(agentsPath)) {
          const stats = fs.lstatSync(agentsPath);
          if (!stats.isSymbolicLink()) {
            fs.unlinkSync(agentsPath);
          } else {
            const target = fs.readlinkSync(agentsPath);
            if (target !== SHARED_AGENTS_PATH) {
              fs.unlinkSync(agentsPath);
            } else {
              continue; // 이미 정상 심링크
            }
          }
        }
        fs.symlinkSync(SHARED_AGENTS_PATH, agentsPath);
        fixed++;
      }
    }

    // 레거시 파일은 --fix로 삭제하지 않음 (수동 확인 필요)
    // legacy/ 체크는 경고만 표시
  }

  return fixed;
}

// ============================================================
// KB domain checks (async, requires pool)
// ============================================================

const KB_REQUIRED_DOMAINS = ["semicolon"] as const;

export async function auditBotKb(
  pool: Pool
): Promise<AuditCheck[]> {
  const checks: AuditCheck[] = [];

  try {
    const result = await pool.query(
      `SELECT domain, COUNT(*)::int as cnt
       FROM semo.knowledge_base
       WHERE domain = ANY($1)
       GROUP BY domain`,
      [KB_REQUIRED_DOMAINS]
    );

    const counts = new Map<string, number>(
      result.rows.map((r: { domain: string; cnt: number }) => [r.domain, r.cnt])
    );

    for (const domain of KB_REQUIRED_DOMAINS) {
      const cnt = counts.get(domain) ?? 0;
      checks.push({
        name: `kb/${domain}`,
        passed: cnt > 0,
        detail: cnt > 0
          ? `KB ${domain} 도메인: ${cnt}개 엔트리`
          : `KB ${domain} 도메인: 엔트리 없음`,
      });
    }
  } catch (err) {
    for (const domain of KB_REQUIRED_DOMAINS) {
      checks.push({
        name: `kb/${domain}`,
        passed: false,
        detail: `KB 조회 실패: ${err}`,
      });
    }
  }

  return checks;
}

// ============================================================
// DB sync checks (async, requires pool)
// ============================================================

const SYNC_STALE_HOURS = 24;

export async function auditBotDb(
  botId: string,
  pool: Pool
): Promise<AuditCheck[]> {
  const checks: AuditCheck[] = [];

  try {
    const result = await pool.query(
      "SELECT synced_at FROM semo.bot_status WHERE bot_id = $1",
      [botId]
    );
    const registered = result.rows.length > 0;

    checks.push({
      name: "db/registered",
      passed: registered,
      detail: registered ? "bot_status에 등록됨" : "bot_status에 미등록",
    });

    if (registered) {
      const syncedAt = result.rows[0].synced_at;
      const hoursAgo = syncedAt
        ? (Date.now() - new Date(syncedAt).getTime()) / 3600000
        : Infinity;
      const recent = hoursAgo < SYNC_STALE_HOURS;
      checks.push({
        name: "db/synced_recent",
        passed: recent,
        detail: recent
          ? `${Math.round(hoursAgo)}시간 전 동기화`
          : syncedAt
            ? `${Math.round(hoursAgo)}시간 전 (>${SYNC_STALE_HOURS}h stale)`
            : "synced_at 없음",
      });
    } else {
      checks.push({
        name: "db/synced_recent",
        passed: false,
        detail: "DB 미등록 — 동기화 불가",
      });
    }
  } catch (err) {
    checks.push({
      name: "db/registered",
      passed: false,
      detail: `DB 조회 실패: ${err}`,
    });
    checks.push({
      name: "db/synced_recent",
      passed: false,
      detail: "DB 조회 실패",
    });
  }

  return checks;
}

export function mergeDbChecks(
  result: BotAuditResult,
  dbChecks: AuditCheck[]
): BotAuditResult {
  const allChecks = [...result.checks, ...dbChecks];
  const passed = allChecks.filter((c) => c.passed).length;
  const total = allChecks.length;
  const score = Math.round((passed / total) * 100);

  const memorySlim = allChecks.find((c) => c.name === "memory/slim");
  const isMemorySlim = memorySlim ? memorySlim.passed : true;

  let rating: BotAuditResult["rating"];
  if (score >= 80 && isMemorySlim) {
    rating = "GOOD";
  } else if (score >= 50) {
    rating = "NEEDS-WORK";
  } else {
    rating = "POOR";
  }

  return { botId: result.botId, rating, score, checks: allChecks };
}

// ============================================================
// Slack formatter
// ============================================================

const RATING_EMOJI: Record<string, string> = {
  GOOD: "🟢",
  "NEEDS-WORK": "🟡",
  POOR: "🔴",
};

export function formatAuditSlack(results: BotAuditResult[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const good = results.filter((r) => r.rating === "GOOD").length;
  const needsWork = results.filter((r) => r.rating === "NEEDS-WORK").length;
  const poor = results.filter((r) => r.rating === "POOR").length;
  const avgScore = Math.round(
    results.reduce((s, r) => s + r.score, 0) / results.length
  );

  const lines: string[] = [
    `📋 *봇 워크스페이스 Audit* — ${date}`,
    "",
  ];

  for (const r of results) {
    const emoji = RATING_EMOJI[r.rating] ?? "⚪";
    const failed = r.checks.filter((c) => !c.passed);
    const failInfo =
      failed.length > 0
        ? ` — missing: ${failed.map((c) => c.name).join(", ")}`
        : "";
    lines.push(`${emoji} *${r.botId}* ${r.score}% ${r.rating}${failInfo}`);
  }

  lines.push("");
  lines.push(
    `${results.length}개 봇 | 평균 ${avgScore}% | GOOD: ${good} / NEEDS-WORK: ${needsWork} / POOR: ${poor}`
  );

  return lines.join("\n");
}

// ============================================================
// DB storage
// ============================================================

export async function storeAuditResults(
  results: BotAuditResult[],
  client: PoolClient
): Promise<void> {
  const runId = randomUUID();

  for (const r of results) {
    await client.query(
      `INSERT INTO semo.bot_workspace_audits (bot_id, run_id, rating, score, checks)
       VALUES ($1, $2, $3, $4, $5)`,
      [r.botId, runId, r.rating, r.score, JSON.stringify(r.checks)]
    );
  }
}
