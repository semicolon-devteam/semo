/**
 * Service Migration — 기존 운영 서비스를 services 테이블에 이식
 *
 * KB 온톨로지에 service 타입으로 등록된 도메인 중 services에 미등록된 것을
 * 자동으로 이식. KB 엔트리 전수 조사(audit) 후 매핑/비매핑 분류.
 */

import type { Pool } from 'pg';
import chalk from 'chalk';
import { kbGet, kbList, kbUpsert } from './kb';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

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
  action: 'created' | 'skipped' | 'error';
  projectId?: string;
  audit: AuditResult;
  error?: string;
}

// ── KB Status Mapping ──

export const STATUS_MAP: Record<string, { lifecycle: string; status: string }> = {
  active: { lifecycle: 'ops', status: 'active' },
  hold: { lifecycle: 'ops', status: 'paused' },
  maintenance: { lifecycle: 'ops', status: 'active' },
  completed: { lifecycle: 'sunset', status: 'completed' },
  deprecated: { lifecycle: 'sunset', status: 'completed' },
};

// Keys that map directly to services columns
const COLUMN_KEYS: Record<string, string> = {
  'base-information': 'project_name',
  po: 'owner_name',
  status: 'status+lifecycle',
};

// Keys that go into metadata JSONB
const METADATA_KEYS = new Set(['repo', 'slack-channel', 'tech-stack', 'service-url', 'bm']);

// Keys that stay in KB only (normal)
const KB_ONLY_KEYS = new Set([
  'current-situation',
  'kpi',
  'milestone',
  'decision',
  'process',
  'infra',
]);

// Projection keys (auto-managed by pm-pipeline)
const PROJECTION_KEYS = new Set([
  'spec',
  'pm-status',
  'gfp-status',
  'gfp-id',
  'infra-status',
  'pm-summary',
]);

// ── Core Functions ──

export async function getUnregisteredServices(
  pool: Pool,
): Promise<Array<{ domain: string; description: string | null; created_at: string | null }>> {
  // ontology service 도메인 중 KB pipeline/config가 없는 것
  const result = await pool.query(
    `SELECT o.domain, o.description, o.created_at::text
     FROM ${DB_SCHEMA}.ontology o
     WHERE o.entity_type = 'service'
       AND o.domain NOT LIKE 'e2e-%'
       AND NOT EXISTS (
         SELECT 1 FROM ${DB_SCHEMA}.knowledge_base kb
         WHERE kb.domain = o.domain AND kb.key = 'pipeline' AND kb.sub_key = 'config'
       )
     ORDER BY o.domain`,
  );
  return result.rows;
}

export async function getRegisteredServices(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    `SELECT kb.domain AS service_domain
     FROM ${DB_SCHEMA}.knowledge_base kb
     JOIN ${DB_SCHEMA}.ontology o ON o.domain = kb.domain AND o.entity_type = 'service'
     WHERE kb.key = 'pipeline' AND kb.sub_key = 'config'`,
  );
  return result.rows.map((r: { service_domain: string }) => r.service_domain);
}

export async function auditServiceKBEntries(
  pool: Pool,
  domain: string,
  ontologyDescription: string | null,
  ontologyCreatedAt: string | null,
): Promise<AuditResult> {
  // Fetch ALL KB entries for this domain
  const entriesResult = await pool.query(
    `SELECT key, sub_key, content
     FROM ${DB_SCHEMA}.knowledge_base
     WHERE domain = $1
     ORDER BY key, sub_key`,
    [domain],
  );
  const entries = (
    entriesResult.rows as Array<{
      key: string;
      sub_key: string;
      content: string;
    }>
  ).map((e) => ({ ...e, content: (e.content ?? '').substring(0, 500) }));

  // Fetch allowed keys from type schema
  const schemaResult = await pool.query(
    `SELECT scheme_key, COALESCE(source, 'manual') as source
     FROM ${DB_SCHEMA}.kb_type_schema WHERE type_key = 'service'`,
  );
  const allowedKeys = new Set(schemaResult.rows.map((r: { scheme_key: string }) => r.scheme_key));

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
      // Maps to services column
      const firstContent = items[0]?.content ?? '';
      audit.mapped.push({
        key,
        target: COLUMN_KEYS[key],
        value: firstContent.substring(0, 200),
      });
    } else if (METADATA_KEYS.has(key)) {
      const firstContent = items[0]?.content ?? '';
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
  for (const reqKey of ['base-information', 'po', 'status']) {
    if (!byKey.has(reqKey)) {
      audit.missingRequired.push(reqKey);
    }
  }

  return audit;
}

export function buildServiceProjectRow(audit: AuditResult): MigrationRow {
  // Extract project_name from base-information
  const baseInfo = audit.mapped.find((m) => m.key === 'base-information');
  let projectName = audit.domain; // fallback
  if (baseInfo) {
    // Take first line or first sentence as project name
    const firstLine = baseInfo.value.split('\n')[0].trim();
    // Try to extract name pattern like "AXOracle — 오라클 정보 플랫폼"
    const match = firstLine.match(/^([^—–\-]+)/);
    projectName = match ? match[1].trim() : firstLine.substring(0, 100);
  } else if (audit.ontologyDescription) {
    const match = audit.ontologyDescription.match(/^([^—–\-]+)/);
    projectName = match ? match[1].trim() : audit.ontologyDescription.substring(0, 100);
  }

  // Extract owner from po
  const poEntry = audit.mapped.find((m) => m.key === 'po');
  const ownerName = poEntry ? poEntry.value.split('\n')[0].trim().substring(0, 100) : 'TBD';

  // Map status
  const statusEntry = audit.mapped.find((m) => m.key === 'status');
  const rawStatus = statusEntry ? statusEntry.value.split('\n')[0].trim().toLowerCase() : 'active';
  const mapping = STATUS_MAP[rawStatus] ?? STATUS_MAP['active'];

  // Build metadata from repo, slack-channel, tech-stack, etc.
  const meta: Record<string, unknown> = { source: 'kb-migration' };
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

export async function insertServiceProject(pool: Pool, row: MigrationRow): Promise<string> {
  const { kbUpsert } = await import('./kb.js');
  const { randomUUID } = await import('crypto');
  const serviceId = randomUUID();
  const now = new Date().toISOString();
  await kbUpsert(pool, {
    domain: row.service_domain,
    key: 'pipeline/config',
    content: row.project_name,
    metadata: {
      service_id: serviceId,
      project_name: row.project_name,
      owner_name: row.owner_name,
      status: row.status,
      lifecycle: row.lifecycle,
      current_phase: 0,
      infra_phase: null,
      service_type: 'general',
      parent_service_id: null,
      tech_stack: null,
      service_url: null,
      bm: null,
      repo: null,
      slack_channel: null,
      launched_at: row.launched_at,
      project_metadata: row.metadata,
      created_at: now,
    },
    created_by: 'service-migrate',
  });
  return serviceId;
}

export async function writePmSummaryToKB(
  pool: Pool,
  domain: string,
  projectId: string,
  row: MigrationRow,
  kbEntryCount: number,
): Promise<void> {
  const content = [
    `service_id: ${projectId}`,
    `project_name: ${row.project_name}`,
    `lifecycle: ${row.lifecycle}`,
    `status: ${row.status}`,
    `source: kb-migration`,
    `registered_at: ${new Date().toISOString()}`,
    `kb_entries: ${kbEntryCount}`,
    `owner: ${row.owner_name}`,
  ].join('\n');

  await kbUpsert(pool, {
    domain,
    key: 'pm-summary',
    content,
    created_by: 'pm-pipeline',
  });
}

// ── Reporting ──

export function printAuditReport(results: MigrationResult[]): void {
  const created = results.filter((r) => r.action === 'created');
  const skipped = results.filter((r) => r.action === 'skipped');
  const errors = results.filter((r) => r.action === 'error');

  console.log(chalk.cyan.bold(`\n📊 서비스 이식 결과\n`));
  console.log(
    `  ${chalk.green(`✓ 등록: ${created.length}`)}  ${chalk.yellow(`⊘ 건너뜀: ${skipped.length}`)}  ${chalk.red(`✗ 오류: ${errors.length}`)}`,
  );

  for (const r of results) {
    const icon =
      r.action === 'created'
        ? chalk.green('✓')
        : r.action === 'skipped'
          ? chalk.yellow('⊘')
          : chalk.red('✗');

    console.log(`\n  ${icon} ${chalk.bold(r.domain)}`);

    if (r.action === 'created') {
      console.log(
        chalk.gray(
          `    service_id: ${r.projectId}\n` +
            `    mapped: ${r.audit.mapped.map((m) => m.key).join(', ') || '(없음)'}\n` +
            `    metadata: ${r.audit.metadata.map((m) => m.key).join(', ') || '(없음)'}\n` +
            `    kb-only: ${r.audit.kbOnly.map((k) => `${k.key}(${k.count})`).join(', ') || '(없음)'}`,
        ),
      );
    }

    if (r.action === 'error') {
      console.log(chalk.red(`    ${r.error}`));
    }

    // Warnings
    if (r.audit.warnings.length > 0) {
      console.log(chalk.yellow('    ⚠ 비표준 키:'));
      for (const w of r.audit.warnings) {
        console.log(chalk.yellow(`      ${w.key}: ${w.reason}`));
        console.log(chalk.gray(`        → ${w.suggestion}`));
      }
    }

    // Missing required
    if (r.audit.missingRequired.length > 0) {
      console.log(chalk.yellow(`    ⚠ 필수 키 누락: ${r.audit.missingRequired.join(', ')}`));
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
    console.log(
      chalk.gray(
        `    → project_name: ${row.project_name}\n` +
          `    → owner_name: ${row.owner_name}\n` +
          `    → lifecycle: ${row.lifecycle}, status: ${row.status}\n` +
          `    → launched_at: ${row.launched_at ?? 'NOW()'}\n` +
          `    → metadata keys: ${Object.keys(row.metadata).join(', ')}`,
      ),
    );

    if (r.audit.kbOnly.length > 0) {
      console.log(
        chalk.gray(
          `    → kb-only: ${r.audit.kbOnly.map((k) => `${k.key}(${k.count})`).join(', ')}`,
        ),
      );
    }

    if (r.audit.warnings.length > 0) {
      for (const w of r.audit.warnings) {
        console.log(chalk.yellow(`    ⚠ ${w.key}: ${w.reason}`));
        console.log(chalk.gray(`      → ${w.suggestion}`));
      }
    }

    if (r.audit.missingRequired.length > 0) {
      console.log(chalk.yellow(`    ⚠ 필수 키 누락: ${r.audit.missingRequired.join(', ')}`));
    }

    console.log();
  }

  console.log(chalk.cyan(`  총 ${results.length}개 서비스 이식 대상\n`));
}

// ── Service Project Lookup / Update / Diagnose ──

export interface ServiceProjectRow {
  service_id: string;
  project_name: string;
  service_domain: string | null;
  owner_name: string;
  owner_contact: string | null;
  current_phase: number;
  infra_phase: number | null;
  status: string;
  lifecycle: string;
  launched_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  service_type: string;
  parent_service_id: string | null;
}

export async function getServiceProjectByDomain(
  pool: Pool,
  domain: string,
): Promise<ServiceProjectRow | null> {
  const { kbGet } = await import('./kb.js');
  const entry = await kbGet(pool, domain, 'pipeline/config');
  if (!entry) return null;
  const m = (entry.metadata ?? {}) as Record<string, unknown>;
  return {
    service_id: (m.service_id as string) ?? domain,
    project_name: (m.project_name as string) ?? '',
    service_domain: domain,
    owner_name: (m.owner_name as string) ?? '',
    owner_contact: (m.owner_contact as string) ?? null,
    current_phase: (m.current_phase as number) ?? 0,
    infra_phase: (m.infra_phase as number) ?? null,
    status: (m.status as string) ?? 'active',
    lifecycle: (m.lifecycle as string) ?? 'build',
    launched_at: (m.launched_at as string) ?? null,
    metadata: (m.project_metadata as Record<string, unknown>) ?? {},
    created_at: (m.created_at as string) ?? '',
    updated_at: entry.updated_at ?? '',
    parent_service_id: (m.parent_service_id as string) ?? null,
  } as ServiceProjectRow;
}

export interface ServiceProjectUpdate {
  status?: string;
  lifecycle?: string;
  current_phase?: number;
  project_name?: string;
  owner_name?: string;
  metadata?: Record<string, unknown>;
  tech_stack?: string;
  service_url?: string;
  bm?: string;
  repo?: string;
  slack_channel?: string;
  discord_channel?: string;
  service_type?: string;
  parent_service_id?: string;
}

export async function updateServiceProject(
  pool: Pool,
  domain: string,
  updates: ServiceProjectUpdate,
): Promise<ServiceProjectRow | null> {
  if (Object.keys(updates).length === 0) return getServiceProjectByDomain(pool, domain);

  const { kbUpdateMetadata } = await import('./kb.js');
  const patch: Record<string, unknown> = {};

  if (updates.project_name !== undefined) patch.project_name = updates.project_name;
  if (updates.owner_name !== undefined) patch.owner_name = updates.owner_name;
  if (updates.current_phase !== undefined) patch.current_phase = updates.current_phase;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.lifecycle !== undefined) {
    patch.lifecycle = updates.lifecycle;
    if (updates.lifecycle === 'ops') {
      const existing = await getServiceProjectByDomain(pool, domain);
      if (existing && !existing.launched_at) {
        patch.launched_at = new Date().toISOString();
      }
    }
  }
  if (updates.metadata !== undefined) {
    const existing = await getServiceProjectByDomain(pool, domain);
    patch.project_metadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      ...updates.metadata,
    };
  }
  if (updates.tech_stack !== undefined) patch.tech_stack = updates.tech_stack;
  if (updates.service_url !== undefined) patch.service_url = updates.service_url;
  if (updates.bm !== undefined) patch.bm = updates.bm;
  if (updates.repo !== undefined) patch.repo = updates.repo;
  if (updates.slack_channel !== undefined) patch.slack_channel = updates.slack_channel || null;
  if (updates.discord_channel !== undefined)
    patch.discord_channel = updates.discord_channel || null;
  if (updates.service_type !== undefined) patch.service_type = updates.service_type;
  if (updates.parent_service_id !== undefined) patch.parent_service_id = updates.parent_service_id;

  const needsChannelSync =
    updates.slack_channel !== undefined || updates.discord_channel !== undefined;

  if (needsChannelSync) {
    // KB + ontology 채널 매핑을 단일 트랜잭션으로 동기화
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const domainCheck = await client.query(
        `SELECT 1 FROM ${DB_SCHEMA}.ontology WHERE domain = $1`,
        [domain],
      );
      if (domainCheck.rows.length === 0) {
        throw new Error(`도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다.`);
      }

      await client.query(
        `UPDATE ${DB_SCHEMA}.knowledge_base
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, updated_at = NOW()
         WHERE domain = $1 AND key = $2 AND sub_key = $3`,
        [domain, 'pipeline', 'config', JSON.stringify(patch)],
      );

      const setClauses: string[] = [];
      const params: (string | null)[] = [domain];
      let idx = 2;
      if (updates.slack_channel !== undefined) {
        setClauses.push(`slack_channel = $${idx++}`);
        params.push(updates.slack_channel || null);
      }
      if (updates.discord_channel !== undefined) {
        setClauses.push(`discord_channel = $${idx++}`);
        params.push(updates.discord_channel || null);
      }
      await client.query(
        `UPDATE ${DB_SCHEMA}.ontology SET ${setClauses.join(', ')} WHERE domain = $1`,
        params,
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    await kbUpdateMetadata(pool, domain, 'pipeline/config', patch);
  }

  return getServiceProjectByDomain(pool, domain);
}

// ── Diagnose ──

export interface DiagnoseMismatch {
  field: string;
  kbValue: string;
  spValue: string;
  expected: string;
}

export interface DiagnoseResult {
  domain: string;
  verdict: 'healthy' | 'mismatch' | 'kb-only' | 'sp-only' | 'missing';
  kbEntryCount: number;
  kbKeys: string[];
  serviceProject: ServiceProjectRow | null;
  mismatches: DiagnoseMismatch[];
  missingRequired: string[];
}

export async function diagnoseServiceStatus(pool: Pool, domain: string): Promise<DiagnoseResult> {
  // 1. KB 도메인 존재 확인
  const ontoResult = await pool.query(
    `SELECT domain, description, created_at::text
     FROM ${DB_SCHEMA}.ontology WHERE domain = $1 AND entity_type = 'service'`,
    [domain],
  );
  const kbExists = ontoResult.rows.length > 0;

  // 2. services 조회
  const sp = await getServiceProjectByDomain(pool, domain);

  // 3. 분류
  if (!kbExists && !sp) {
    return {
      domain,
      verdict: 'missing',
      kbEntryCount: 0,
      kbKeys: [],
      serviceProject: null,
      mismatches: [],
      missingRequired: [],
    };
  }

  if (!kbExists && sp) {
    return {
      domain,
      verdict: 'sp-only',
      kbEntryCount: 0,
      kbKeys: [],
      serviceProject: sp,
      mismatches: [],
      missingRequired: [],
    };
  }

  // KB 엔트리 목록
  const entriesResult = await pool.query(
    `SELECT DISTINCT key FROM ${DB_SCHEMA}.knowledge_base WHERE domain = $1 ORDER BY key`,
    [domain],
  );
  const kbKeys = entriesResult.rows.map((r: { key: string }) => r.key);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int as cnt FROM ${DB_SCHEMA}.knowledge_base WHERE domain = $1`,
    [domain],
  );
  const kbEntryCount = countResult.rows[0]?.cnt ?? 0;

  if (kbExists && !sp) {
    // 필수 키 체크
    const missingRequired: string[] = [];
    for (const req of ['base-information', 'po', 'status']) {
      if (!kbKeys.includes(req)) missingRequired.push(req);
    }
    return {
      domain,
      verdict: 'kb-only',
      kbEntryCount,
      kbKeys,
      serviceProject: null,
      mismatches: [],
      missingRequired,
    };
  }

  // 4. 양쪽 다 존재 → 교차 비교
  const mismatches: DiagnoseMismatch[] = [];

  // KB status vs services status/lifecycle
  const statusEntry = await pool.query(
    `SELECT content FROM ${DB_SCHEMA}.knowledge_base
     WHERE domain = $1 AND key = 'status' AND (sub_key IS NULL OR sub_key = '')
     LIMIT 1`,
    [domain],
  );
  if (statusEntry.rows.length > 0 && sp) {
    const kbStatus = statusEntry.rows[0].content.split('\n')[0].trim().toLowerCase();
    const expected = STATUS_MAP[kbStatus];
    if (expected) {
      if (expected.lifecycle !== sp.lifecycle) {
        mismatches.push({
          field: 'lifecycle',
          kbValue: `status=${kbStatus} → lifecycle=${expected.lifecycle}`,
          spValue: sp.lifecycle,
          expected: expected.lifecycle,
        });
      }
      if (expected.status !== sp.status) {
        mismatches.push({
          field: 'status',
          kbValue: `status=${kbStatus} → status=${expected.status}`,
          spValue: sp.status,
          expected: expected.status,
        });
      }
    }
  }

  // KB po vs services owner_name
  const poEntry = await pool.query(
    `SELECT content FROM ${DB_SCHEMA}.knowledge_base
     WHERE domain = $1 AND key = 'po' AND (sub_key IS NULL OR sub_key = '')
     LIMIT 1`,
    [domain],
  );
  if (poEntry.rows.length > 0 && sp) {
    const kbPo = poEntry.rows[0].content.split('\n')[0].trim().toLowerCase();
    if (kbPo !== sp.owner_name.toLowerCase()) {
      mismatches.push({
        field: 'owner',
        kbValue: kbPo,
        spValue: sp.owner_name,
        expected: kbPo,
      });
    }
  }

  // section 존재 여부 vs current_phase (KB section/* 키 조회)
  if (sp && sp.lifecycle === 'build' && sp.current_phase > 0) {
    const { kbCountByKeyPrefix } = await import('./kb.js');
    const approvedSections = await kbCountByKeyPrefix(pool, domain, 'section', '', {
      status: 'approved',
    });
    if (approvedSections === 0 && sp.current_phase > 0) {
      mismatches.push({
        field: 'phase',
        kbValue: '승인된 섹션 0개',
        spValue: `current_phase=${sp.current_phase}`,
        expected: 'phase=0 (승인된 섹션 없음)',
      });
    }
  }

  return {
    domain,
    verdict: mismatches.length > 0 ? 'mismatch' : 'healthy',
    kbEntryCount,
    kbKeys,
    serviceProject: sp,
    mismatches,
    missingRequired: [],
  };
}
