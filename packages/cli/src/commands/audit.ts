/**
 * Bot Workspace Audit — 표준 구조 compliance 감사
 *
 * 12가지 체크를 수행하고 점수/등급을 산정한다.
 *   - 파일 9개 (root 7 + memory/slim + skills/)
 *   - KB 3개 (team, process, decision 도메인 존재)
 * --fix 옵션으로 누락 파일/디렉토리 자동 생성 가능.
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
// Check definitions
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
      const passed = lines < 50;
      return {
        name: "memory/slim",
        passed,
        detail: passed
          ? `MEMORY.md is ${lines} lines (< 50)`
          : `MEMORY.md is ${lines} lines (>= 50, bloated)`,
      };
    },
  };
}

const CHECK_DEFS: CheckDef[] = [
  // 1-7: Root files
  fileExistsCheck("root/SOUL.md", "SOUL.md"),
  fileExistsCheck("root/IDENTITY.md", "IDENTITY.md"),
  fileExistsCheck("root/AGENTS.md", "AGENTS.md"),
  fileExistsCheck("root/USER.md", "USER.md"),
  fileExistsCheck("root/TOOLS.md", "TOOLS.md"),
  fileExistsCheck("root/RULES.md", "RULES.md"),
  fileExistsCheck("root/MEMORY.md", "MEMORY.md"),
  // 8: Memory slim
  memorySlimCheck(),
  // 9: skills/
  dirExistsCheck("skills/", "skills"),
];

// ============================================================
// Core audit function
// ============================================================

export function auditBot(botDir: string, botId: string): BotAuditResult {
  const checks = CHECK_DEFS.map((def) => def.check(botDir, botId));
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  const memorySlim = checks.find((c) => c.name === "memory/slim");
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
// Auto-fix
// ============================================================

const FIXABLE_FILES: Record<string, string> = {
  "root/SOUL.md": "SOUL.md",
  "root/IDENTITY.md": "IDENTITY.md",
  "root/AGENTS.md": "AGENTS.md",
  "root/USER.md": "USER.md",
  "root/TOOLS.md": "TOOLS.md",
  "root/RULES.md": "RULES.md",
  "root/MEMORY.md": "MEMORY.md",
};

const FIXABLE_DIRS: Record<string, string> = {
  "skills/": "skills",
};

const FILE_TEMPLATES: Record<string, (botId: string) => string> = {
  "RULES.md": (botId) =>
    `# RULES.md — ${botId} 행동 규칙\n\n> 공식 표준: kb_get(domain='process', key='bot-workspace-standard')\n\n## NON-NEGOTIABLE\n\n## 행동 원칙\n\n## 금지 사항\n`,
};

export function fixBot(
  botDir: string,
  botId: string,
  checks: AuditCheck[]
): number {
  let fixed = 0;

  for (const check of checks) {
    if (check.passed) continue;

    // Fix missing files
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
  }

  return fixed;
}

// ============================================================
// DB storage
// ============================================================

// ============================================================
// KB domain checks (async, requires pool)
// ============================================================

const KB_REQUIRED_DOMAINS = ["team", "process", "decision"] as const;

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
