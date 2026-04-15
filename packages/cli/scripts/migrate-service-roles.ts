#!/usr/bin/env npx tsx
/**
 * DEPRECATED: services 테이블이 KB로 이식됨 (v4.8.0, migration 100-101).
 * 이 스크립트는 레거시 일회성 마이그레이션용. 재실행 불필요.
 *
 * migrate-service-roles.ts
 *
 * services.owner_name → KB role/po 엔트리 생성.
 * base-information에서 "담당:" 패턴 추출 → 후보 목록 출력.
 *
 * Usage:
 *   npx tsx scripts/migrate-service-roles.ts [--dry-run]
 *   npx tsx scripts/migrate-service-roles.ts --extract  # base-info에서 역할 후보 추출만
 */

import { getPool, closeConnection } from '../src/database';

const DRY_RUN = process.argv.includes('--dry-run');
const EXTRACT_ONLY = process.argv.includes('--extract');

async function main() {
  const pool = getPool();

  if (EXTRACT_ONLY) {
    // base-information에서 "담당:" 패턴 추출
    const res = await pool.query<{ domain: string; content: string }>(
      `SELECT domain, content FROM semo.knowledge_base
       WHERE key = 'base-information' AND sub_key = ''
       AND content LIKE '%담당%'
       ORDER BY domain`,
    );

    console.log(`[extract] "담당" 포함 base-information: ${res.rows.length}건\n`);
    for (const row of res.rows) {
      const match = row.content.match(/담당[:\s]*(.+?)(?:\.|$|\n)/);
      if (match) {
        console.log(`  ${row.domain}: ${match[1].trim()}`);
      }
    }
    await closeConnection();
    return;
  }

  // owner_name → role/po 마이그레이션
  const services = await pool.query<{ service_domain: string; owner_name: string }>(
    `SELECT service_domain, owner_name FROM semo.services
     WHERE service_domain IS NOT NULL AND owner_name IS NOT NULL AND owner_name != ''`,
  );

  console.log(`[migrate] ${services.rows.length}개 서비스의 owner_name → role/po 이관\n`);

  let created = 0;
  let skipped = 0;

  for (const svc of services.rows) {
    // 이미 role/po가 있는지 확인
    const existing = await pool.query(
      `SELECT 1 FROM semo.knowledge_base WHERE domain = $1 AND key = 'role' AND sub_key = 'po' LIMIT 1`,
      [svc.service_domain],
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const content = svc.owner_name.toLowerCase().trim();

    if (DRY_RUN) {
      console.log(`  [dry-run] ${svc.service_domain}/role/po → "${content}"`);
    } else {
      await pool.query(
        `INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by)
         VALUES ($1, 'role', 'po', $2, 'migration-072')`,
        [svc.service_domain, content],
      );
      console.log(`  ✔ ${svc.service_domain}/role/po → "${content}"`);
    }
    created++;
  }

  console.log(
    `\n[migrate] ${DRY_RUN ? '(DRY RUN) ' : ''}Created: ${created}, Skipped (existing): ${skipped}`,
  );

  await closeConnection();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
