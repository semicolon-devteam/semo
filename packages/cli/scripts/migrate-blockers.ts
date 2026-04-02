#!/usr/bin/env npx tsx
/**
 * migrate-blockers.ts
 *
 * 기존 action-item, current-situation 엔트리에 분산된 블로커 데이터를
 * 새 blocker collection 키로 마이그레이션.
 *
 * Usage:
 *   npx tsx scripts/migrate-blockers.ts [--dry-run]
 */

import { getPool, closeConnection } from "../src/database";
import { kbUpsert } from "../src/kb";

const DRY_RUN = process.argv.includes("--dry-run");

interface BlockerEntry {
  domain: string;
  sub_key: string; // blocker/{date}/{slug}
  content: string;
  source: string; // 마이그레이션 소스 설명
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function buildBlockerContent(opts: {
  status: string;
  startDate: string;
  resolvedDate: string;
  assignee: string;
  service: string;
  source: string;
  description: string;
  impact: string;
}): string {
  return [
    `**상태:** ${opts.status}`,
    `**시작일:** ${opts.startDate}`,
    `**해결일:** ${opts.resolvedDate}`,
    `**담당자:** ${opts.assignee}`,
    `**서비스:** ${opts.service}`,
    `**출처:** ${opts.source}`,
    "",
    "### 설명",
    opts.description,
    "",
    "### 영향",
    opts.impact,
    "",
    "### 해결 기록",
    "—",
  ].join("\n");
}

async function extractFromActionItems(pool: ReturnType<typeof getPool>): Promise<BlockerEntry[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT domain, key, sub_key, content, created_at, updated_at
       FROM semo.knowledge_base
       WHERE key = 'action-item'
         AND (content ILIKE '%blocked%' OR content ILIKE '%블로커%')
       ORDER BY created_at`
    );

    const entries: BlockerEntry[] = [];
    for (const row of res.rows) {
      // sub_key 형태: {YYYY-MM-DD}/{slug}
      const dateMatch = row.sub_key.match(/^(\d{4}-\d{2}-\d{2})\//);
      const startDate = dateMatch ? dateMatch[1] : row.created_at.toISOString().slice(0, 10);

      // 담당자 추출
      const assigneeMatch = row.content.match(/담당[:\s]*(\S+)/);
      const assignee = assigneeMatch ? assigneeMatch[1].replace(/[.,]$/, "").toLowerCase() : "—";

      // slug 생성 (action-item sub_key에서 날짜 제거)
      const originalSlug = row.sub_key.replace(/^\d{4}-\d{2}-\d{2}\//, "");
      const slug = toSlug(originalSlug) || toSlug(row.content.slice(0, 50));

      entries.push({
        domain: row.domain,
        sub_key: `${startDate}/${slug}`,
        content: buildBlockerContent({
          status: "active",
          startDate,
          resolvedDate: "—",
          assignee,
          service: row.domain,
          source: `migrate:action-item/${row.sub_key}`,
          description: row.content.replace(/담당[:\s]*\S+[.,]?\s*/g, "").replace(/상태[:\s]*\S+[.,]?\s*/g, "").trim(),
          impact: "— (마이그레이션: 원본에 영향 정보 없음)",
        }),
        source: `action-item/${row.sub_key}`,
      });
    }
    return entries;
  } finally {
    client.release();
  }
}

async function extractFromCurrentSituation(pool: ReturnType<typeof getPool>): Promise<BlockerEntry[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT domain, content, updated_at
       FROM semo.knowledge_base
       WHERE key = 'current-situation'
         AND content ILIKE '%### 블로커%'
       ORDER BY domain`
    );

    const entries: BlockerEntry[] = [];
    for (const row of res.rows) {
      // ### 블로커 섹션 추출
      const blockerMatch = row.content.match(/### 블로커\n([\s\S]*?)(?=\n###|\n## |$)/);
      if (!blockerMatch) continue;

      const blockerSection = blockerMatch[1].trim();
      const items = blockerSection
        .split("\n")
        .map((l: string) => l.replace(/^[-*]\s*/, "").trim())
        .filter((l: string) => l.length > 0);

      const baseDate = row.updated_at.toISOString().slice(0, 10);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const slug = toSlug(item) || `blocker-${i + 1}`;

        entries.push({
          domain: row.domain,
          sub_key: `${baseDate}/${slug}`,
          content: buildBlockerContent({
            status: "active",
            startDate: baseDate,
            resolvedDate: "—",
            assignee: "—",
            service: row.domain,
            source: `migrate:current-situation`,
            description: item,
            impact: "— (마이그레이션: 원본에 영향 정보 없음)",
          }),
          source: `current-situation (item ${i + 1})`,
        });
      }
    }
    return entries;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`\n🔄 블로커 마이그레이션${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const pool = getPool();

  // 소스별 추출
  const fromActionItems = await extractFromActionItems(pool);
  const fromCurrentSituation = await extractFromCurrentSituation(pool);
  const all = [...fromActionItems, ...fromCurrentSituation];

  console.log(`  action-item에서 추출: ${fromActionItems.length}건`);
  console.log(`  current-situation에서 추출: ${fromCurrentSituation.length}건`);
  console.log(`  합계: ${all.length}건\n`);

  if (all.length === 0) {
    console.log("마이그레이션 대상 없음.");
    await closeConnection();
    return;
  }

  // 미리보기
  for (const entry of all) {
    console.log(`  [${entry.domain}] blocker/${entry.sub_key}`);
    console.log(`    소스: ${entry.source}`);
  }

  if (DRY_RUN) {
    console.log("\n⏸ DRY RUN 완료 — 실제 기록하지 않음.");
    await closeConnection();
    return;
  }

  // 실행
  console.log("\n📝 KB 기록 중...\n");
  let success = 0;
  let failed = 0;

  for (const entry of all) {
    const result = await kbUpsert(pool, {
      domain: entry.domain,
      key: "blocker",
      sub_key: entry.sub_key,
      content: entry.content,
      created_by: "migrate-blockers",
    });

    if (result.success) {
      console.log(`  ✅ [${entry.domain}] blocker/${entry.sub_key}`);
      success++;
    } else {
      console.log(`  ❌ [${entry.domain}] blocker/${entry.sub_key}: ${result.error}`);
      failed++;
    }
  }

  console.log(`\n완료: ${success}건 성공, ${failed}건 실패\n`);
  await closeConnection();
}

main().catch((err) => {
  console.error("마이그레이션 실패:", err);
  process.exit(1);
});
