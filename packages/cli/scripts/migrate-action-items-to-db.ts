#!/usr/bin/env npx tsx
/**
 * migrate-action-items-to-db.ts
 *
 * KB의 action-item 엔트리를 semo.action_items 테이블로 일회성 마이그레이션.
 * 기존 KB 마크다운 파서(3포맷)를 인라인으로 포함하여 파싱 후 DB INSERT.
 *
 * Usage:
 *   npx tsx scripts/migrate-action-items-to-db.ts [--dry-run]
 *
 * 선행 조건: migration 069 적용 완료
 */

import { getPool, closeConnection } from '../src/database';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Inline parser (lib/action-items.ts에서 추출) ──

interface ParsedItem {
  itemIndex: number;
  description: string;
  assignee: string | null;
  deadline: string | null;
  status: 'open' | 'completed';
  service: string | null;
  source: string | null;
}

function parsePersonTable(content: string): ParsedItem[] {
  const lines = content.split('\n');
  const items: ParsedItem[] = [];
  let idx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.includes('| # |') || trimmed.includes('|---|')) continue;
    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    items.push({
      itemIndex: idx,
      description: cells[1] || '',
      assignee: null,
      deadline: cells[2] || null,
      status: cells[3]?.toLowerCase().includes('completed') ? 'completed' : 'open',
      service: cells[4] || null,
      source: cells[5] || null,
    });
    idx++;
  }
  return items;
}

function parseServiceSpecific(content: string): ParsedItem[] {
  const fields: Record<string, string> = {};
  const lines = content.split('\n');
  let title = '';
  for (const line of lines) {
    const hm = line.match(/^##\s+(.+)/);
    if (hm) {
      title = hm[1].trim();
      continue;
    }
    const fm = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
    if (fm) fields[fm[1]] = fm[2].trim();
  }
  const description = fields['내용'] || title || '';
  if (!description) return [];
  return [
    {
      itemIndex: 0,
      description,
      assignee: fields['담당자'] || null,
      deadline: fields['기한'] || null,
      status: fields['상태']?.toLowerCase().includes('completed') ? 'completed' : 'open',
      service: null,
      source: fields['출처'] || null,
    },
  ];
}

function parseServiceBatch(content: string): ParsedItem[] {
  const lines = content.split('\n');
  const items: ParsedItem[] = [];
  let currentAssignee: string | null = null;
  let idx = 0;
  for (const line of lines) {
    const hm = line.match(/^###\s+(.+)/);
    if (hm) {
      currentAssignee = hm[1].replace(/\s*\(.+\)\s*$/, '').trim();
      continue;
    }
    const cm = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (cm) {
      items.push({
        itemIndex: idx,
        description: cm[2].trim(),
        assignee: currentAssignee,
        deadline: null,
        status: cm[1].toLowerCase() === 'x' ? 'completed' : 'open',
        service: null,
        source: null,
      });
      idx++;
    }
  }
  return items;
}

function parseActionItems(content: string): ParsedItem[] {
  if (!content) return [];
  if (content.includes('| # |') || content.includes('| 항목 |')) return parsePersonTable(content);
  if (content.includes('- **담당자**:')) return parseServiceSpecific(content);
  if (/- \[[ xX]\]/.test(content)) return parseServiceBatch(content);
  for (const parser of [parsePersonTable, parseServiceSpecific, parseServiceBatch]) {
    const result = parser(content);
    if (result.length > 0) return result;
  }
  return [];
}

// ── Main ──

async function main() {
  const pool = getPool();

  // 1. KB에서 모든 action-item 엔트리 조회
  const kbRes = await pool.query<{
    kb_id: string;
    domain: string;
    sub_key: string;
    content: string;
  }>(
    `SELECT kb_id, domain, sub_key, content
     FROM semo.knowledge_base
     WHERE key = 'action-item'
     ORDER BY domain, sub_key`,
  );

  console.log(`[migrate] Found ${kbRes.rows.length} KB action-item entries`);

  // 2. ontology → entity_type 매핑
  const ontoRes = await pool.query<{ domain: string; entity_type: string }>(
    `SELECT domain, entity_type FROM semo.ontology`,
  );
  const entityTypeMap = new Map(ontoRes.rows.map((r) => [r.domain, r.entity_type]));

  // 3. nickname → domain 매핑
  const nickRes = await pool.query<{ domain: string; content: string }>(
    `SELECT domain, content FROM semo.knowledge_base WHERE key = 'nickname'`,
  );
  const nicknameToDomain = new Map(
    nickRes.rows.map((r) => [r.content.trim().toLowerCase(), r.domain]),
  );

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const row of kbRes.rows) {
    const items = parseActionItems(row.content);
    if (items.length === 0) continue;

    const entityType = entityTypeMap.get(row.domain);
    const domainType = entityType === 'team' ? 'team' : 'service';

    for (const item of items) {
      // 중복 체크: 같은 kb_domain + kb_sub_key + kb_item_index
      const dupCheck = await pool.query(
        `SELECT 1 FROM semo.action_items
         WHERE metadata->>'kb_domain' = $1
           AND metadata->>'kb_sub_key' = $2
           AND (metadata->>'kb_item_index')::int = $3
         LIMIT 1`,
        [row.domain, row.sub_key, item.itemIndex],
      );
      if (dupCheck.rows.length > 0) {
        totalSkipped++;
        continue;
      }

      // owner_domain 결정
      let ownerDomain: string;
      if (domainType === 'team') {
        ownerDomain = row.domain;
      } else if (item.assignee) {
        // assignee → ontology domain 직접 매칭
        const lowerAssignee = item.assignee.toLowerCase();
        if (entityTypeMap.has(lowerAssignee)) {
          ownerDomain = lowerAssignee;
        } else if (nicknameToDomain.has(lowerAssignee)) {
          ownerDomain = nicknameToDomain.get(lowerAssignee)!;
        } else {
          ownerDomain = row.domain; // 폴백: KB 도메인 자체
        }
      } else {
        ownerDomain = row.domain;
      }

      // owner_domain이 ontology에 존재하는지 확인
      if (!entityTypeMap.has(ownerDomain)) {
        ownerDomain = 'semicolon';
      }

      // target_domain 결정
      let targetDomain: string | null = null;
      if (domainType === 'service') {
        targetDomain = row.domain;
      } else if (item.service) {
        const svcDomain = item.service.toLowerCase().replace(/\s+/g, '-');
        if (entityTypeMap.has(svcDomain)) {
          targetDomain = svcDomain;
        }
      }

      // deadline 파싱: MM/DD → YYYY-MM-DD, 무효하면 null
      let parsedDeadline: string | null = null;
      if (item.deadline) {
        const isoMatch = item.deadline.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) {
          parsedDeadline = isoMatch[1];
        } else {
          const mdMatch = item.deadline.match(/(\d{1,2})\/(\d{1,2})/);
          if (mdMatch) {
            const year = new Date().getFullYear();
            parsedDeadline = `${year}-${mdMatch[1].padStart(2, '0')}-${mdMatch[2].padStart(2, '0')}`;
          }
        }
      }

      // date 추출
      const dateMatch = row.sub_key.match(/^\d{4}-\d{2}-\d{2}/);

      if (DRY_RUN) {
        console.log(
          `  [dry-run] INSERT: owner=${ownerDomain}, target=${targetDomain}, desc="${item.description.slice(0, 50)}", status=${item.status}`,
        );
      } else {
        await pool.query(
          `INSERT INTO semo.action_items
            (owner_domain, target_domain, description, assignee, deadline, status, priority, source, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'normal', 'kb-migration', $7, $8)`,
          [
            ownerDomain,
            targetDomain,
            item.description,
            item.assignee || (domainType === 'team' ? row.domain : null),
            parsedDeadline,
            item.status,
            JSON.stringify({
              kb_domain: row.domain,
              kb_sub_key: row.sub_key,
              kb_item_index: item.itemIndex,
              source: item.source,
            }),
            dateMatch ? new Date(dateMatch[0]) : new Date(),
          ],
        );
      }
      totalInserted++;
    }
  }

  console.log(
    `[migrate] ${DRY_RUN ? '(DRY RUN) ' : ''}Inserted: ${totalInserted}, Skipped (duplicates): ${totalSkipped}`,
  );

  await closeConnection();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
