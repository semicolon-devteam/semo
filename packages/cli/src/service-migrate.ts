/**
 * Service Migration — 기존 운영 서비스를 service_projects 테이블에 이식
 *
 * KB 온톨로지에 service 타입으로 등록된 도메인 중 service_projects에 미등록된 것을
 * 자동으로 이식. KB 엔트리 전수 조사(audit) 후 매핑/비매핑 분류.
 */

import { Pool } from "pg";
import chalk from "chalk";
import { kbGet, kbList, kbUpsert } from "./kb";

// ── Types ──

export interface AuditEntry {
  key: string;
  subKey: string;
  target: string; // 'column:owner_name' | 'metadata:repo' | 'kb-only' | 'projection' | 'unknown'
  value: string;
}

export interface AuditResult {
  domain: string;
  ontologyDescription: string | null;
  ontologyCreatedAt: string | null;
  mapped: { key: string; target: string; value: string }[];
  metadata: { key: string; value: string }[];
  kbOnly: { key: string; count: number }[];
  projection: { key: string; count: number }[];
  warnings: { key: string; reason: string; suggestion: string }[];
  missingRequired: string[];
}

export interface MigrationRow {
  project_name: string;
  owner_name: string;
  service_domain: string;
  status: string;
  lifecycle: string;
  launched_at: string | null;
  metadata: Record<string, unknown>;
}

export interface MigrationResult {
  domain: string;
  action: "created" | "skipped" | "error";
  projectId?: string;
  audit: AuditResult;
  error?: string;
}

// ── KB Status Mapping ──

const STATUS_MAP: Record<string, { lifecycle: string; status: string }> = {
  active: { lifecycle: "ops", status: "active" },
  hold: { lifecycle: "ops", status: "paused" },
  maintenance: { lifecycle: "ops", status: "active" },
  completed: { lifecycle: "sunset", status: "completed" },
  deprecated: { lifecycle: "sunset", status: "completed" },
};

// Keys that map directly to service_projects columns
const COLUMN_KEYS: Record<string, string> = {
  "base-information": "project_name",
  po: "owner_name",
  status: "status+lifecycle",
};

// Keys that go into metadata JSONB
const METADATA_KEYS = new Set([
  "repo",
  "slack-channel",
  "tech-stack",
  "service-url",
  "bm",
]);

// Keys that stay in KB only (normal)
const KB_ONLY_KEYS = new Set([
  "current-situation",
  "kpi",
  "milestone",
  "decision",
  "process",
  "infra",
]);

// Projection keys (auto-managed by pm-pipeline)
const PROJECTION_KEYS = new Set([
  "spec",
  "pm-status",
  "gfp-status",
  "gfp-id",
  "infra-status",
  "pm-summary",
]);

// ── Core Functions ──

export async function getUnregisteredServices(
  pool: Pool
): Promise<Array<{ domain: string; description: string | null; created_at: string | null }>> {
  const result = await pool.query(
    `SELECT o.domain, o.description, o.created_at::text
     FROM semo.ontology o
     WHERE o.entity_type = 'service'
       AND o.domain NOT LIKE 'e2e-%'
       AND NOT EXISTS (
         SELECT 1 FROM semo.service_projects sp WHERE sp.service_domain = o.domain
       )
     ORDER BY o.domain`
  );
  return result.rows;
}

export async function getRegisteredServices(
  pool: Pool
): Promise<string[]> {
  const result = await pool.query(
    `SELECT service_domain FROM semo.service_projects WHERE service_domain IS NOT NULL`
  );
  return result.rows.map((r: { service_domain: string }) => r.service_domain);
}

export async function auditServiceKBEntries(
  pool: Pool,
  domain: string,
  ontologyDescription: string | null,
  ontologyCreatedAt: string | null
): Promise<AuditResult> {
  // Fetch ALL KB entries for this domain
  const entriesResult = await pool.query(
    `SELECT key, sub_key, content
     FROM semo.knowledge_base
     WHERE domain = $1
     ORDER BY key, sub_key`,
    [domain]
  );
  const entries = (entriesResult.rows as Array<{
    key: string;
    sub_key: string;
    content: string;
  }>).map((e) => ({ ...e, content: (e.content ?? "").substring(0, 500) }));

  // Fetch allowed keys from type schema
  const schemaResult = await pool.query(
    `SELECT scheme_key, COALESCE(source, 'manual') as source
     FROM semo.kb_type_schema WHERE type_key = 'service'`
  );
  const allowedKeys = new Set(
    schemaResult.rows.map((r: { scheme_key: string }) => r.scheme_key)
  );

  const audit: AuditResult = {
    domain,
    ontologyDescription,
    ontologyCreatedAt,
    mapped: [],
    metadata: [],
    kbOnly: [],
    projection: [],
    warnings: [],
    missingRequired: [],
  };

  // Group entries by key
  const byKey = new Map<string, Array<{ sub_key: string; content: string }>>();
  for (const e of entries) {
    const arr = byKey.get(e.key) || [];
    arr.push({ sub_key: e.sub_key, content: e.content });
    byKey.set(e.key, arr);
  }

  for (const [key, items] of byKey) {
    if (COLUMN_KEYS[key]) {
      // Maps to service_projects column
      const firstContent = items[0]?.content ?? "";
      audit.mapped.push({
        key,
        target: COLUMN_KEYS[key],
        value: firstContent.substring(0, 200),
      });
    } else if (METADATA_KEYS.has(key)) {
      const firstContent = items[0]?.content ?? "";
      audit.metadata.push({ key, value: firstContent.substring(0, 200) });
    } else if (KB_ONLY_KEYS.has(key)) {
      audit.kbOnly.push({ key, count: items.length });
    } else if (PROJECTION_KEYS.has(key)) {
      audit.projection.push({ key, count: items.length });
    } else if (!allowedKeys.has(key)) {
      // Unknown key — not in type schema
      audit.warnings.push({
        key,
        reason: `'${key}'은(는) service 타입 스키마에 등록되지 않은 키`,
        suggestion: `semo kb ontology --action add-key --type service --key ${key} --key-type collection`,
      });
    } else {
      // In schema but not in our classification — treat as KB-only
      audit.kbOnly.push({ key, count: items.length });
    }
  }

  // Check required keys
  for (const reqKey of ["base-information", "po", "status"]) {
    if (!byKey.has(reqKey)) {
      audit.missingRequired.push(reqKey);
    }
  }

  return audit;
}

export function buildServiceProjectRow(
  audit: AuditResult
): MigrationRow {
  // Extract project_name from base-information
  const baseInfo = audit.mapped.find((m) => m.key === "base-information");
  let projectName = audit.domain; // fallback
  if (baseInfo) {
    // Take first line or first sentence as project name
    const firstLine = baseInfo.value.split("\n")[0].trim();
    // Try to extract name pattern like "AXOracle — 오라클 정보 플랫폼"
    const match = firstLine.match(/^([^—–\-]+)/);
    projectName = match ? match[1].trim() : firstLine.substring(0, 100);
  } else if (audit.ontologyDescription) {
    const match = audit.ontologyDescription.match(/^([^—–\-]+)/);
    projectName = match ? match[1].trim() : audit.ontologyDescription.substring(0, 100);
  }

  // Extract owner from po
  const poEntry = audit.mapped.find((m) => m.key === "po");
  const ownerName = poEntry ? poEntry.value.split("\n")[0].trim().substring(0, 100) : "TBD";

  // Map status
  const statusEntry = audit.mapped.find((m) => m.key === "status");
  const rawStatus = statusEntry
    ? statusEntry.value.split("\n")[0].trim().toLowerCase()
    : "active";
  const mapping = STATUS_MAP[rawStatus] ?? STATUS_MAP["active"];

  // Build metadata from repo, slack-channel, tech-stack, etc.
  const meta: Record<string, unknown> = { source: "kb-migration" };
  for (const m of audit.metadata) {
    meta[m.key] = m.value;
  }

  return {
    project_name: projectName,
    owner_name: ownerName,
    service_domain: audit.domain,
    status: mapping.status,
    lifecycle: mapping.lifecycle,
    launched_at: audit.ontologyCreatedAt,
    metadata: meta,
  };
}

export async function insertServiceProject(
  pool: Pool,
  row: MigrationRow
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO semo.service_projects
       (project_name, owner_name, service_domain, status, lifecycle, launched_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING gfp_id`,
    [
      row.project_name,
      row.owner_name,
      row.service_domain,
      row.status,
      row.lifecycle,
      row.launched_at,
      JSON.stringify(row.metadata),
    ]
  );
  return result.rows[0].gfp_id;
}

export async function writePmSummaryToKB(
  pool: Pool,
  domain: string,
  projectId: string,
  row: MigrationRow,
  kbEntryCount: number
): Promise<void> {
  const content = [
    `project_id: ${projectId}`,
    `project_name: ${row.project_name}`,
    `lifecycle: ${row.lifecycle}`,
    `status: ${row.status}`,
    `source: kb-migration`,
    `registered_at: ${new Date().toISOString()}`,
    `kb_entries: ${kbEntryCount}`,
    `owner: ${row.owner_name}`,
  ].join("\n");

  await kbUpsert(pool, {
    domain,
    key: "pm-summary",
    content,
    created_by: "pm-pipeline",
  });
}

// ── Reporting ──

export function printAuditReport(results: MigrationResult[]): void {
  const created = results.filter((r) => r.action === "created");
  const skipped = results.filter((r) => r.action === "skipped");
  const errors = results.filter((r) => r.action === "error");

  console.log(chalk.cyan.bold(`\n📊 서비스 이식 결과\n`));
  console.log(
    `  ${chalk.green(`✓ 등록: ${created.length}`)}  ${chalk.yellow(`⊘ 건너뜀: ${skipped.length}`)}  ${chalk.red(`✗ 오류: ${errors.length}`)}`
  );

  for (const r of results) {
    const icon =
      r.action === "created" ? chalk.green("✓") :
      r.action === "skipped" ? chalk.yellow("⊘") :
      chalk.red("✗");

    console.log(`\n  ${icon} ${chalk.bold(r.domain)}`);

    if (r.action === "created") {
      console.log(
        chalk.gray(
          `    project_id: ${r.projectId}\n` +
          `    mapped: ${r.audit.mapped.map((m) => m.key).join(", ") || "(없음)"}\n` +
          `    metadata: ${r.audit.metadata.map((m) => m.key).join(", ") || "(없음)"}\n` +
          `    kb-only: ${r.audit.kbOnly.map((k) => `${k.key}(${k.count})`).join(", ") || "(없음)"}`
        )
      );
    }

    if (r.action === "error") {
      console.log(chalk.red(`    ${r.error}`));
    }

    // Warnings
    if (r.audit.warnings.length > 0) {
      console.log(chalk.yellow("    ⚠ 비표준 키:"));
      for (const w of r.audit.warnings) {
        console.log(chalk.yellow(`      ${w.key}: ${w.reason}`));
        console.log(chalk.gray(`        → ${w.suggestion}`));
      }
    }

    // Missing required
    if (r.audit.missingRequired.length > 0) {
      console.log(
        chalk.yellow(
          `    ⚠ 필수 키 누락: ${r.audit.missingRequired.join(", ")}`
        )
      );
    }
  }

  console.log();
}

export function printDryRunReport(results: MigrationResult[]): void {
  console.log(chalk.cyan.bold(`\n🔍 서비스 이식 미리보기 (dry-run)\n`));
  console.log(chalk.gray(`  DB 변경 없이 audit 결과만 표시합니다.\n`));

  for (const r of results) {
    const row = buildServiceProjectRow(r.audit);
    console.log(chalk.bold(`  ${r.domain}`));
    console.log(chalk.gray(
      `    → project_name: ${row.project_name}\n` +
      `    → owner_name: ${row.owner_name}\n` +
      `    → lifecycle: ${row.lifecycle}, status: ${row.status}\n` +
      `    → launched_at: ${row.launched_at ?? 'NOW()'}\n` +
      `    → metadata keys: ${Object.keys(row.metadata).join(", ")}`
    ));

    if (r.audit.kbOnly.length > 0) {
      console.log(chalk.gray(
        `    → kb-only: ${r.audit.kbOnly.map((k) => `${k.key}(${k.count})`).join(", ")}`
      ));
    }

    if (r.audit.warnings.length > 0) {
      for (const w of r.audit.warnings) {
        console.log(chalk.yellow(`    ⚠ ${w.key}: ${w.reason}`));
        console.log(chalk.gray(`      → ${w.suggestion}`));
      }
    }

    if (r.audit.missingRequired.length > 0) {
      console.log(
        chalk.yellow(
          `    ⚠ 필수 키 누락: ${r.audit.missingRequired.join(", ")}`
        )
      );
    }

    console.log();
  }

  console.log(chalk.cyan(`  총 ${results.length}개 서비스 이식 대상\n`));
}
