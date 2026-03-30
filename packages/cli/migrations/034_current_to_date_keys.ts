#!/usr/bin/env npx tsx
/**
 * 034_current_to_date_keys.ts
 *
 * KB 데이터 마이그레이션: action-item/current, kpi/current → 날짜 기반 서브키
 * - action-item/current → action-item/{YYYY-MM-DD} (updated_at 기준)
 * - kpi/current → kpi/{YYYY-MM-DD} (updated_at 기준)
 *
 * 사용법:
 *   npx tsx packages/cli/migrations/034_current_to_date_keys.ts [--dry-run]
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 필요합니다");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    // 1. action-item/current 엔트리 조회
    const actionItems = await pool.query(`
      SELECT kb_id, domain, key, sub_key, content, embedding, updated_at
      FROM semo.knowledge_base
      WHERE key = 'action-item' AND sub_key = 'current'
    `);

    console.log(`action-item/current 엔트리: ${actionItems.rows.length}건`);

    // 2. kpi/current 엔트리 조회
    const kpiItems = await pool.query(`
      SELECT kb_id, domain, key, sub_key, content, embedding, updated_at
      FROM semo.knowledge_base
      WHERE key = 'kpi' AND sub_key = 'current'
    `);

    console.log(`kpi/current 엔트리: ${kpiItems.rows.length}건`);

    const allItems = [...actionItems.rows, ...kpiItems.rows];

    if (allItems.length === 0) {
      console.log("마이그레이션 대상 없음");
      return;
    }

    for (const row of allItems) {
      const dateStr = new Date(row.updated_at).toISOString().split("T")[0]; // YYYY-MM-DD
      const newSubKey = dateStr;

      console.log(`  ${row.domain}/${row.key}/current → ${row.domain}/${row.key}/${newSubKey}`);

      if (DRY_RUN) continue;

      // 동일 날짜 서브키가 이미 존재하는지 확인
      const existing = await pool.query(
        `SELECT kb_id FROM semo.knowledge_base WHERE domain = $1 AND key = $2 AND sub_key = $3`,
        [row.domain, row.key, newSubKey]
      );

      if (existing.rows.length > 0) {
        // 이미 존재하면 current 엔트리만 삭제
        console.log(`    (이미 ${newSubKey} 존재 — current만 삭제)`);
      } else {
        // 새 날짜 키로 INSERT
        await pool.query(
          `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, embedding, metadata, version, created_by, updated_at)
           SELECT domain, key, $1, content, embedding, metadata, version, created_by, updated_at
           FROM semo.knowledge_base WHERE kb_id = $2`,
          [newSubKey, row.kb_id]
        );
      }

      // current 엔트리 삭제
      await pool.query(
        `DELETE FROM semo.knowledge_base WHERE kb_id = $1`,
        [row.kb_id]
      );
    }

    if (!DRY_RUN) {
      // 검증
      const remaining = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM semo.knowledge_base WHERE sub_key = 'current' AND key IN ('action-item', 'kpi')`
      );
      console.log(`\n남은 current 서브키: ${remaining.rows[0].cnt}건`);
    }

    console.log("\n마이그레이션 완료");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("에러:", err);
  process.exit(1);
});
