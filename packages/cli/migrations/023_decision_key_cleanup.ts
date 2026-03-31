#!/usr/bin/env npx tsx
/**
 * 023_decision_key_cleanup.ts
 *
 * ~100건의 비표준 decision 키를 표준 형식(decision/{date}/{slug})으로 변환.
 *
 * 변환 규칙:
 * - 이미 decision/{YYYY-MM-DD}/{slug} 형식이면 스킵
 * - content/metadata에서 날짜 추출 시도
 * - 날짜 추출 불가 시 updated_at에서 추출
 * - 키 충돌 시 suffix 추가 (-2, -3, ...)
 *
 * 사용법:
 *   npx tsx packages/cli/migrations/023_decision_key_cleanup.ts [--dry-run]
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 필요합니다");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

const STANDARD_PATTERN = /^decision\/\d{4}-\d{2}-\d{2}\/.+$/;
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2})/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[가-힣]+/g, (match) => match) // keep Korean as-is
    .replace(/[^a-z0-9가-힣\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

function extractDate(keySlug: string, content: string, metadata: Record<string, unknown> | null): string | null {
  // Try metadata first
  if (metadata) {
    for (const k of ["date", "decided_at", "created_at", "timestamp"]) {
      const val = metadata[k];
      if (typeof val === "string") {
        const match = val.match(DATE_PATTERN);
        if (match) return match[1];
      }
    }
  }

  // Try key slug (e.g., "메모리 구조 개편 (2026-02-17)")
  const keyMatch = keySlug.match(DATE_PATTERN);
  if (keyMatch) return keyMatch[1];

  // Try content
  const contentMatch = content.match(DATE_PATTERN);
  if (contentMatch) return contentMatch[1];

  return null;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    // Find all decision keys in semicolon domain
    const result = await pool.query(`
      SELECT domain, key, content, metadata, updated_at::text
      FROM semo.knowledge_base
      WHERE domain = 'semicolon' AND key LIKE 'decision/%'
      ORDER BY key
    `);

    const rows = result.rows;
    console.log(`총 decision 엔트리: ${rows.length}건`);

    const nonStandard = rows.filter((r) => !STANDARD_PATTERN.test(r.key));
    console.log(`비표준 키: ${nonStandard.length}건`);

    if (nonStandard.length === 0) {
      console.log("정리할 항목 없음");
      return;
    }

    // Collect existing keys to avoid conflicts
    const existingKeys = new Set(rows.map((r) => r.key));

    let updated = 0;
    let skipped = 0;

    for (const row of nonStandard) {
      const oldKey = row.key;
      const parts = oldKey.split("/");

      // Extract the "slug" portion (everything after "decision/")
      const rawSlug = parts.slice(1).join("/");

      // Extract date
      let date = extractDate(rawSlug, row.content, row.metadata);
      if (!date && row.updated_at) {
        date = row.updated_at.substring(0, 10);
      }
      if (!date) {
        date = "unknown";
      }

      // If it already has a date as second segment, use that
      if (parts.length >= 3 && DATE_PATTERN.test(parts[1])) {
        // Already has date but may have extra depth — keep as is
        console.log(`  스킵 (이미 날짜 포함): ${oldKey}`);
        skipped++;
        continue;
      }

      const slug = slugify(rawSlug);
      let newKey = `decision/${date}/${slug}`;

      // Dedup: if conflict, add suffix
      if (existingKeys.has(newKey) && newKey !== oldKey) {
        let suffix = 2;
        while (existingKeys.has(`${newKey}-${suffix}`)) suffix++;
        newKey = `${newKey}-${suffix}`;
      }

      if (newKey === oldKey) {
        skipped++;
        continue;
      }

      console.log(`  ${oldKey} → ${newKey}`);

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE semo.knowledge_base SET key = $1 WHERE domain = $2 AND key = $3`,
          [newKey, row.domain, oldKey]
        );
      }

      existingKeys.delete(oldKey);
      existingKeys.add(newKey);
      updated++;
    }

    console.log(`\n결과: ${updated}건 변환, ${skipped}건 스킵${DRY_RUN ? " (dry-run)" : ""}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("에러:", err);
  process.exit(1);
});
