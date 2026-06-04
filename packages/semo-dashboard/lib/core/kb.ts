/**
 * Knowledge Base 라이브러리
 * PostgreSQL + pgvector를 사용한 시맨틱 검색 및 KB 조회
 *
 * NOTE (2026-05-28): 한때 KbStore(@team-semicolon/semo-kb-core) delegate 로
 * backend-agnostic 화를 시도했으나, dashboard Docker 빌드가 subdir 컨텍스트에서
 * standalone `npm install` 을 돌려 미발행 워크스페이스 패키지를 resolve 하지 못한다
 * (E404). coreDB-agnostic dashboard 는 kb-core/kb-pg 를 npm 발행하거나 Docker
 * 빌드 컨텍스트를 repo 루트로 옮긴 뒤 재도입해야 한다. 그때까지 PG 직접 query 유지.
 */

import { Pool } from 'pg';
import { genEmbedding } from '../voyage';
const DB_SCHEMA = process.env.SEMICOLONY_DB_SCHEMA ?? process.env.SEMO_DB_SCHEMA ?? 'semo';

function splitKey(combinedKey: string): { key: string; subKey: string } {
  const idx = combinedKey.indexOf('/');
  if (idx === -1) return { key: combinedKey, subKey: '' };
  return { key: combinedKey.substring(0, idx), subKey: combinedKey.substring(idx + 1) };
}

function combineKey(key: string, subKey: string): string {
  return subKey ? `${key}/${subKey}` : key;
}

const ORDER_ALLOWLIST = ['updated_at', 'created_at', 'key', 'sub_key', 'domain'];
const METADATA_ORDER_ALLOWLIST = [
  'status',
  'priority',
  'phase',
  'category',
  'signal',
  'deadline',
  'ordinal',
  'track',
];
const NUMERIC_META_KEYS = ['ordinal', 'phase'];

function buildMetadataOrderClause(orderBy: string, fallback: string): string {
  if (orderBy.startsWith('metadata.')) {
    const metaKey = orderBy.slice(9);
    if (!METADATA_ORDER_ALLOWLIST.includes(metaKey)) return `ORDER BY ${fallback}`;
    if (NUMERIC_META_KEYS.includes(metaKey)) {
      return `ORDER BY (metadata->>'${metaKey}')::int ASC NULLS LAST`;
    }
    return `ORDER BY metadata->>'${metaKey}' ASC NULLS LAST`;
  }
  if (ORDER_ALLOWLIST.includes(orderBy)) {
    return `ORDER BY ${orderBy} DESC NULLS LAST`;
  }
  return `ORDER BY ${fallback}`;
}

// lib/db.ts와 동일한 DATABASE_URL을 사용하는 Pool
// KB_DB_* 환경변수는 하위 호환성을 위해 유지하되, DATABASE_URL을 우선한다.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 }
    : {
        host: process.env.KB_DB_HOST || '127.0.0.1',
        port: parseInt(process.env.KB_DB_PORT || '5432'),
        user: process.env.KB_DB_USER || 'app',
        password: process.env.KB_DB_PASSWORD || '',
        database: process.env.KB_DB_NAME || 'appdb',
        ssl: false,
        connectionTimeoutMillis: 5000,
      },
);

export interface KBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  updated_at?: string;
  similarity_pct?: number;
}

export interface KBDomain {
  domain: string;
  description?: string;
  entry_count: number;
}

export interface KBStats {
  knowledge_base: {
    total: string;
    emb: string;
    by_domain: Array<{
      domain: string;
      cnt: string;
      emb_cnt: string;
    }>;
  };
}

/**
 * 텍스트 검색 fallback (ILIKE) — 임베딩 키 없을 때 사용
 */
async function textSearch(query: string, limit: number, createdBy?: string): Promise<KBItem[]> {
  const pattern = `%${query}%`;

  let sql = `
    SELECT kb_id, domain, key, sub_key, content, created_by
    FROM ${DB_SCHEMA}.knowledge_base
    WHERE key ILIKE $1 OR sub_key ILIKE $1 OR content ILIKE $1
  `;
  const params: (string | number)[] = [pattern];
  let idx = 2;

  if (createdBy) {
    sql += ` AND created_by = $${idx++}`;
    params.push(createdBy);
  }
  sql += ` ORDER BY updated_at DESC NULLS LAST LIMIT $${idx++}`;
  params.push(limit);

  const res = await pool.query(sql, params);
  return res.rows.map((r: KBItem & { sub_key?: string }) => ({
    ...r,
    key: combineKey(r.key, r.sub_key ?? ''),
  }));
}

/**
 * 시맨틱 검색 (OpenAI 임베딩 + pgvector), 키 없으면 텍스트 검색 fallback.
 */
export async function search(
  query: string,
  limit: number = 10,
  createdBy?: string,
): Promise<KBItem[]> {
  if (!process.env.OPENAI_API_KEY) {
    return textSearch(query, limit, createdBy);
  }

  const embedding = await genEmbedding(query);
  const embeddingStr = '[' + embedding.join(',') + ']';

  let sql = `
    SELECT kb_id, domain, key, sub_key, content, created_by,
           ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
    FROM ${DB_SCHEMA}.knowledge_base
  `;
  const params: (string | number)[] = [embeddingStr];
  let idx = 2;

  if (createdBy) {
    sql += ` WHERE created_by = $${idx++}`;
    params.push(createdBy);
  }
  sql += ` ORDER BY embedding <=> $1::vector LIMIT $${idx++}`;
  params.push(limit);

  const res = await pool.query(sql, params);
  return res.rows.map((r: KBItem & { sub_key?: string }) => ({
    ...r,
    key: combineKey(r.key, r.sub_key ?? ''),
  }));
}

/**
 * KB 목록 조회 (domain 또는 bot_id 필터 지원, metadata 필터링 가능)
 */
export async function list(
  domain?: string,
  createdBy?: string,
  options?: { key?: string; where?: Record<string, unknown>; orderBy?: string },
): Promise<KBItem[]> {
  const cols = domain
    ? 'kb_id, domain, key, sub_key, content, metadata, created_by, updated_at'
    : 'kb_id, domain, key, sub_key, content, created_by';
  let sql = `
    SELECT ${cols}
    FROM ${DB_SCHEMA}.knowledge_base
  `;
  const params: (string | number)[] = [];
  const conditions: string[] = [];
  let idx = 1;

  if (domain) {
    conditions.push(`domain = $${idx++}`);
    params.push(domain);
  }
  if (createdBy) {
    conditions.push(`created_by = $${idx++}`);
    params.push(createdBy);
  }
  if (options?.key) {
    conditions.push(`key = $${idx++}`);
    params.push(options.key);
  }
  if (options?.where) {
    for (const [k, v] of Object.entries(options.where)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      if (v === null) {
        conditions.push(`metadata->>$${idx++} IS NULL`);
        params.push(k);
      } else if (typeof v === 'object') {
        conditions.push(`metadata @> $${idx++}::jsonb`);
        params.push(JSON.stringify({ [k]: v }));
      } else {
        conditions.push(`metadata->>$${idx++} = $${idx++}`);
        params.push(k);
        params.push(String(v));
      }
    }
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (options?.orderBy) {
    sql += ` ${buildMetadataOrderClause(options.orderBy, 'domain')}`;
  } else {
    sql += ` ORDER BY domain, key`;
  }

  const res = await pool.query(sql, params);
  const rows = res.rows.map((row: KBItem & { sub_key?: string }) => ({
    ...row,
    key: combineKey(row.key, row.sub_key ?? ''),
  }));
  if (!domain) {
    return rows.map((row) => ({
      ...row,
      content: row.content?.length > 80 ? row.content.slice(0, 80) : row.content,
    }));
  }
  return rows;
}

/**
 * KB 항목 수 조회 (domain + key + metadata 필터)
 */
export async function count(
  domain: string,
  key?: string,
  where?: Record<string, unknown>,
): Promise<number> {
  const conditions: string[] = [`domain = $1`];
  const params: (string | number)[] = [domain];
  let idx = 2;

  if (key) {
    conditions.push(`key = $${idx++}`);
    params.push(key);
  }
  if (where) {
    for (const [k, v] of Object.entries(where)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      if (v === null) {
        conditions.push(`metadata->>$${idx++} IS NULL`);
        params.push(k);
      } else if (typeof v === 'object') {
        conditions.push(`metadata @> $${idx++}::jsonb`);
        params.push(JSON.stringify({ [k]: v }));
      } else {
        conditions.push(`metadata->>$${idx++} = $${idx++}`);
        params.push(k);
        params.push(String(v));
      }
    }
  }

  const res = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${DB_SCHEMA}.knowledge_base WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return res.rows[0].count;
}

/**
 * 도메인 목록 조회 (통계 포함)
 * `${DB_SCHEMA}.ontology` LEFT JOIN 으로 description/service/entity_type 를 가져오고
 * KB 엔트리가 0건인 ontology 도메인까지 포함한다 (ontology 는 PG/대시보드 고유 개념).
 */
export async function listDomains(): Promise<KBDomain[]> {
  const sql = `
    SELECT o.domain, o.description, o.service, o.entity_type,
           COUNT(k.kb_id) as entry_count
    FROM ${DB_SCHEMA}.ontology o
    LEFT JOIN ${DB_SCHEMA}.knowledge_base k ON o.domain = k.domain
    GROUP BY o.domain, o.description, o.service, o.entity_type
    ORDER BY o.service NULLS FIRST, o.domain
  `;
  const res = await pool.query(sql);
  return res.rows;
}

/**
 * 전 도메인에서 특정 key를 가진 항목 조회 (예: key=milestone)
 */
export async function listByKey(key: string): Promise<KBItem[]> {
  const sql = `
    SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
    FROM ${DB_SCHEMA}.knowledge_base
    WHERE key = $1
    ORDER BY domain, sub_key
  `;
  const res = await pool.query(sql, [key]);
  return res.rows.map((r: KBItem & { sub_key?: string }) => ({
    ...r,
    key: combineKey(r.key, r.sub_key ?? ''),
  }));
}

/**
 * 특정 KB 항목 조회
 */
export async function getItem(domain: string, rawKey: string): Promise<KBItem | null> {
  const { key, subKey } = splitKey(rawKey);
  const sql = `
    SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
    FROM ${DB_SCHEMA}.knowledge_base
    WHERE domain = $1 AND key = $2 AND sub_key = $3
  `;
  const res = await pool.query(sql, [domain, key, subKey]);
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, key: combineKey(row.key, row.sub_key) };
}

/**
 * KB 항목 upsert (domain + key 기준)
 */
export async function upsertItem(
  domain: string,
  rawKey: string,
  content: string,
  createdBy?: string,
  metadata?: Record<string, unknown>,
): Promise<KBItem> {
  const { key, subKey } = splitKey(rawKey);

  // Domain validation: check ontology before write
  const domainCheck = await pool.query(`SELECT 1 FROM ${DB_SCHEMA}.ontology WHERE domain = $1`, [
    domain,
  ]);
  if (domainCheck.rows.length === 0) {
    const knownDomains = await pool.query(
      `SELECT domain FROM ${DB_SCHEMA}.ontology ORDER BY domain`,
    );
    const known = knownDomains.rows.map((r: { domain: string }) => r.domain);
    throw new Error(
      `도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${known.join(', ')}]`,
    );
  }

  // Type schema validation + projection key 차단 (CLI kbUpsert와 동일 enforcement)
  const typeResult = await pool.query(
    `SELECT entity_type FROM ${DB_SCHEMA}.ontology WHERE domain = $1 AND entity_type IS NOT NULL`,
    [domain],
  );
  if (typeResult.rows.length > 0) {
    const entityType = typeResult.rows[0].entity_type;
    const schemaResult = await pool.query(
      `SELECT scheme_key, COALESCE(key_type, 'singleton') as key_type, COALESCE(source, 'manual') as source FROM ${DB_SCHEMA}.kb_type_schema WHERE type_key = $1`,
      [entityType],
    );
    const schemas = schemaResult.rows as Array<{
      scheme_key: string;
      key_type: string;
      source: string;
    }>;
    if (schemas.length > 0) {
      const match = schemas.find((s) => s.scheme_key === key);
      // Projection key 차단: pm-pipeline/gfp-pipeline만 쓰기 허용
      if (match?.source === 'projection') {
        const cb = createdBy ?? '';
        if (!cb.startsWith('pm-') && !cb.startsWith('gfp-')) {
          throw new Error(
            `키 '${key}'은(는) projection 키입니다 (PM 파이프라인에서 자동 동기화). 직접 쓰기가 차단됩니다.`,
          );
        }
      }
    }
  }

  // 임베딩 필수 생성 (CLI와 동일 — NULL 임베딩은 벡터 검색 누락 유발)
  const embeddingText = `${combineKey(key, subKey)}: ${content}`;
  const embedding = await genEmbedding(embeddingText);
  const embeddingStr = '[' + embedding.join(',') + ']';

  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const sql = metadataJson
    ? `INSERT INTO ${DB_SCHEMA}.knowledge_base (domain, key, sub_key, content, created_by, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
       ON CONFLICT (domain, key, sub_key) DO UPDATE SET
         content    = EXCLUDED.content,
         embedding  = EXCLUDED.embedding,
         metadata   = COALESCE(${DB_SCHEMA}.knowledge_base.metadata, '{}'::jsonb) || EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`
    : `INSERT INTO ${DB_SCHEMA}.knowledge_base (domain, key, sub_key, content, created_by, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (domain, key, sub_key) DO UPDATE SET
         content    = EXCLUDED.content,
         embedding  = EXCLUDED.embedding,
         updated_at = NOW()
       RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`;

  const params = metadataJson
    ? [domain, key, subKey, content, createdBy ?? 'dashboard', embeddingStr, metadataJson]
    : [domain, key, subKey, content, createdBy ?? 'dashboard', embeddingStr];

  const res = await pool.query(sql, params);
  const item = res.rows[0];

  return { ...item, key: combineKey(item.key, item.sub_key) };
}

/**
 * KB metadata만 업데이트 (임베딩 재생성 없음)
 * 워크플로우 상태 변경(status, qa_items 등)에 사용 — 임베딩 비용 절감
 */
export async function updateMetadata(
  domain: string,
  rawKey: string,
  metadataPatch: Record<string, unknown>,
): Promise<KBItem | null> {
  const { key, subKey } = splitKey(rawKey);

  // Domain validation only (no type schema / projection check — metadata-only)
  const domainCheck = await pool.query(`SELECT 1 FROM ${DB_SCHEMA}.ontology WHERE domain = $1`, [
    domain,
  ]);
  if (domainCheck.rows.length === 0) {
    throw new Error(`도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다.`);
  }

  const res = await pool.query(
    `UPDATE ${DB_SCHEMA}.knowledge_base
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
         updated_at = NOW()
     WHERE domain = $1 AND key = $2 AND sub_key = $3
     RETURNING kb_id, domain, key, sub_key, content, metadata, created_by, updated_at`,
    [domain, key, subKey, JSON.stringify(metadataPatch)],
  );

  const row = res.rows[0];
  if (!row) return null;
  return { ...row, key: combineKey(row.key, row.sub_key) };
}

/**
 * sub_key 접두사로 KB 항목 목록 조회
 * 예: listByKeyPrefix('axoracle', 'section', 'plan/3/') → phase 3 plan track 섹션들
 */
export async function listByKeyPrefix(
  domain: string,
  key: string,
  subKeyPrefix: string,
  options?: { where?: Record<string, unknown>; orderBy?: string },
): Promise<KBItem[]> {
  const conditions: string[] = [`domain = $1`, `key = $2`, `sub_key LIKE $3`];
  const params: (string | number)[] = [domain, key, subKeyPrefix + '%'];
  let idx = 4;

  if (options?.where) {
    for (const [k, v] of Object.entries(options.where)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      if (v === null) {
        conditions.push(`metadata->>$${idx++} IS NULL`);
        params.push(k);
      } else if (typeof v === 'object') {
        conditions.push(`metadata @> $${idx++}::jsonb`);
        params.push(JSON.stringify({ [k]: v }));
      } else {
        conditions.push(`metadata->>$${idx} = $${idx + 1}`);
        params.push(k);
        params.push(String(v));
        idx += 2;
      }
    }
  }

  const orderClause = options?.orderBy
    ? buildMetadataOrderClause(options.orderBy, 'sub_key')
    : 'ORDER BY sub_key';

  const sql = `
    SELECT kb_id, domain, key, sub_key, content, metadata, created_by, updated_at
    FROM ${DB_SCHEMA}.knowledge_base
    WHERE ${conditions.join(' AND ')}
    ${orderClause}
  `;

  const res = await pool.query(sql, params);
  return res.rows.map((r: KBItem & { sub_key?: string }) => ({
    ...r,
    key: combineKey(r.key, r.sub_key ?? ''),
  }));
}

/**
 * sub_key 접두사로 KB 항목 수 조회 (metadata 필터 지원)
 * 예: countByKeyPrefix('axoracle', 'section', 'plan/3/', { status: 'approved' })
 */
export async function countByKeyPrefix(
  domain: string,
  key: string,
  subKeyPrefix: string,
  where?: Record<string, unknown>,
): Promise<number> {
  const conditions: string[] = [`domain = $1`, `key = $2`, `sub_key LIKE $3`];
  const params: (string | number)[] = [domain, key, subKeyPrefix + '%'];
  let idx = 4;

  if (where) {
    for (const [k, v] of Object.entries(where)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      if (v === null) {
        conditions.push(`metadata->>$${idx++} IS NULL`);
        params.push(k);
      } else if (typeof v === 'object') {
        conditions.push(`metadata @> $${idx++}::jsonb`);
        params.push(JSON.stringify({ [k]: v }));
      } else {
        conditions.push(`metadata->>$${idx} = $${idx + 1}`);
        params.push(k);
        params.push(String(v));
        idx += 2;
      }
    }
  }

  const res = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${DB_SCHEMA}.knowledge_base WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return res.rows[0].count;
}

/**
 * 전 도메인에서 특정 entity_type + key 조합 조회 (크로스 도메인 프로젝트 목록 등)
 */
export async function listByKeyAcrossDomains(
  entityType: string,
  key: string,
  where?: Record<string, unknown>,
): Promise<KBItem[]> {
  const { key: flatKey, subKey } = splitKey(key);
  const conditions: string[] = [`o.entity_type = $1`, `kb.key = $2`, `kb.sub_key = $3`];
  const params: (string | number)[] = [entityType, flatKey, subKey];
  let idx = 4;

  if (where) {
    for (const [k, v] of Object.entries(where)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      if (v === null) {
        conditions.push(`kb.metadata->>$${idx++} IS NULL`);
        params.push(k);
      } else if (typeof v === 'object') {
        conditions.push(`kb.metadata @> $${idx++}::jsonb`);
        params.push(JSON.stringify({ [k]: v }));
      } else {
        conditions.push(`kb.metadata->>$${idx} = $${idx + 1}`);
        params.push(k);
        params.push(String(v));
        idx += 2;
      }
    }
  }

  const sql = `
    SELECT kb.kb_id, kb.domain, kb.key, kb.sub_key, kb.content, kb.metadata, kb.created_by, kb.updated_at
    FROM ${DB_SCHEMA}.knowledge_base kb
    JOIN ${DB_SCHEMA}.ontology o ON o.domain = kb.domain
    WHERE ${conditions.join(' AND ')}
    ORDER BY kb.domain
  `;

  const res = await pool.query(sql, params);
  return res.rows.map((r: KBItem & { sub_key?: string }) => ({
    ...r,
    key: combineKey(r.key, r.sub_key ?? ''),
  }));
}

/**
 * KB 항목 삭제
 */
export async function deleteItemByKey(domain: string, rawKey: string): Promise<boolean> {
  const { key, subKey } = splitKey(rawKey);
  const res = await pool.query(
    `DELETE FROM ${DB_SCHEMA}.knowledge_base WHERE domain = $1 AND key = $2 AND sub_key = $3`,
    [domain, key, subKey],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteItemsByDomain(domain: string): Promise<number> {
  const res = await pool.query(`DELETE FROM ${DB_SCHEMA}.knowledge_base WHERE domain = $1`, [
    domain,
  ]);
  return res.rowCount ?? 0;
}

/**
 * 전체 KB 통계
 */
export async function stats(): Promise<KBStats> {
  const kbByDomain = await pool.query(
    `SELECT domain, count(*) as cnt, count(embedding) as emb_cnt
     FROM ${DB_SCHEMA}.knowledge_base
     GROUP BY domain
     ORDER BY domain`,
  );

  const totKb = await pool.query(
    `SELECT count(*) as total, count(embedding) as emb FROM ${DB_SCHEMA}.knowledge_base`,
  );

  return {
    knowledge_base: {
      total: totKb.rows[0].total,
      emb: totKb.rows[0].emb,
      by_domain: kbByDomain.rows,
    },
  };
}
