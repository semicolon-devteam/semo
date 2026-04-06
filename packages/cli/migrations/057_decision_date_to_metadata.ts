/**
 * 057_decision_date_to_metadata.ts
 *
 * decision 엔트리의 날짜를 sub_key에서 metadata.decided_at으로 이동.
 * 중복 엔트리(날짜 반복 suffix 등)를 정리.
 *
 * Usage:
 *   npx tsx packages/cli/migrations/057_decision_date_to_metadata.ts --dry-run
 *   npx tsx packages/cli/migrations/057_decision_date_to_metadata.ts
 */

import { Pool } from 'pg';
import { kbUpsert, kbDelete } from '../src/kb';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.resolve(process.env.HOME!, '.claude/semo/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)='?(.*?)'?$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

interface DecisionRow {
  kb_id: number;
  sub_key: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_by: string;
  updated_at: string;
}

/** Extract date prefix and clean slug from sub_key */
function extractDateAndSlug(subKey: string): {
  date: string | null;
  slug: string;
} {
  const match = subKey.match(/^(\d{4}-\d{2}-\d{2})\/(.+)$/);
  if (!match) return { date: null, slug: subKey };

  const rawSlug = match[2];

  // Remove trailing date suffixes: "-2026-02-17-xxx-2026-02-23-yyy" → base slug only
  // Strategy: find the core slug before any date suffix pattern
  const slug = rawSlug.replace(/(-\d{4}-\d{2}-\d{2}(-[a-z가-힣]+-?)*)+$/, '');

  return { date: match[1], slug: slug || rawSlug };
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // 1. Fetch all decision entries
    const { rows } = await pool.query<DecisionRow>(
      `SELECT kb_id, sub_key, content, metadata, created_by, updated_at::text
       FROM semo.knowledge_base
       WHERE domain = 'semicolon' AND key = 'decision'
       ORDER BY sub_key`,
    );

    console.log(`📋 Total decision entries: ${rows.length}`);

    // 2. Group by normalized slug
    const groups = new Map<string, { original: DecisionRow; date: string | null }[]>();

    let skipCount = 0;
    for (const row of rows) {
      const { date, slug } = extractDateAndSlug(row.sub_key);

      if (!date) {
        // Already new pattern (no date prefix) — skip but ensure metadata
        skipCount++;
        continue;
      }

      const existing = groups.get(slug) || [];
      existing.push({ original: row, date });
      groups.set(slug, existing);
    }

    console.log(`📊 Entries with date prefix: ${rows.length - skipCount}`);
    console.log(`📊 Already clean (no date): ${skipCount}`);
    console.log(`📊 Unique slugs after normalization: ${groups.size}`);

    // 3. Process each group
    let migratedCount = 0;
    let deletedDuplicates = 0;
    let errorCount = 0;

    for (const [slug, entries] of groups) {
      // Pick the best entry: longest content (most complete version)
      entries.sort((a, b) => b.original.content.length - a.original.content.length);
      const best = entries[0];

      // Build new metadata
      const newMetadata: Record<string, unknown> = {
        ...(best.original.metadata || {}),
        decided_at: best.date,
      };
      // Remove old 'date' field if exists (normalize to decided_at)
      if ('date' in newMetadata && newMetadata.date === best.date) {
        delete newMetadata.date;
      }

      if (DRY_RUN) {
        console.log(
          `  [DRY] ${best.original.sub_key} → ${slug} (date: ${best.date}, dupes: ${entries.length - 1})`,
        );
        if (entries.length > 1) {
          for (const dup of entries.slice(1)) {
            console.log(
              `         ↳ delete dupe: ${dup.original.sub_key} (${dup.original.content.length} chars)`,
            );
          }
        }
        migratedCount++;
        deletedDuplicates += entries.length - 1;
        continue;
      }

      // Delete ALL entries in this group (including the best one — we'll re-create it)
      for (const entry of entries) {
        const delResult = await kbDelete(pool, 'semicolon', 'decision', entry.original.sub_key);
        if (!delResult.deleted) {
          console.error(`  ❌ Delete failed: ${entry.original.sub_key} — ${delResult.error}`);
          errorCount++;
        }
      }

      // Re-create with clean slug
      const upsertResult = await kbUpsert(pool, {
        domain: 'semicolon',
        key: 'decision',
        sub_key: slug,
        content: best.original.content,
        metadata: newMetadata,
        created_by: best.original.created_by || 'migration-057',
      });

      if (upsertResult.success) {
        migratedCount++;
        deletedDuplicates += entries.length - 1;
      } else {
        console.error(`  ❌ Upsert failed: ${slug} — ${upsertResult.error}`);
        errorCount++;
      }
    }

    console.log(`\n✅ 결과:`);
    console.log(`  마이그레이션: ${migratedCount}개`);
    console.log(`  중복 제거: ${deletedDuplicates}개`);
    console.log(`  에러: ${errorCount}개`);
    if (DRY_RUN) console.log(`  ⚠️  DRY-RUN 모드 — 실제 변경 없음`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
