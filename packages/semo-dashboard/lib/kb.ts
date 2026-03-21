/**
 * Knowledge Base 라이브러리
 * PostgreSQL + pgvector를 사용한 시맨틱 검색 및 KB 조회
 */

import { Pool } from 'pg';
import { genEmbedding } from './voyage';

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
      }
);

export interface KBItem {
  kb_id: number;
  domain: string;
  key: string;
  content: string;
  metadata?: Record<string, any>;
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
async function textSearch(
  query: string,
  limit: number,
  createdBy?: string
): Promise<KBItem[]> {
  const pattern = `%${query}%`;

  let sql = `
    SELECT kb_id, domain, key, content, created_by
    FROM semo.knowledge_base
    WHERE key ILIKE $1 OR content ILIKE $1
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
  return res.rows;
}

/**
 * 시맨틱 검색 (OpenAI 임베딩 + pgvector), 키 없으면 텍스트 검색 fallback
 */
export async function search(
  query: string,
  limit: number = 10,
  createdBy?: string
): Promise<KBItem[]> {
  if (!process.env.OPENAI_API_KEY) {
    return textSearch(query, limit, createdBy);
  }

  const embedding = await genEmbedding(query);
  const embeddingStr = '[' + embedding.join(',') + ']';

  let sql = `
    SELECT kb_id, domain, key, content, created_by,
           ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
    FROM semo.knowledge_base
  `;
  const params: any[] = [embeddingStr];
  let idx = 2;

  if (createdBy) {
    sql += ` WHERE created_by = $${idx++}`;
    params.push(createdBy);
  }
  sql += ` ORDER BY embedding <=> $1::vector LIMIT $${idx++}`;
  params.push(limit);

  const res = await pool.query(sql, params);
  return res.rows;
}

/**
 * KB 목록 조회 (domain 또는 bot_id 필터 지원)
 */
export async function list(
  domain?: string,
  createdBy?: string
): Promise<KBItem[]> {
  // domain 필터 시 full content + metadata 반환 (milestone 등에서 필요)
  // 전체 목록: LEFT(content, N)이 일부 한글 데이터에서 UTF-8 깨짐 → JS truncate
  const cols = domain
    ? 'kb_id, domain, key, content, metadata, created_by, updated_at'
    : 'kb_id, domain, key, content, created_by';
  let sql = `
    SELECT ${cols}
    FROM semo.knowledge_base
  `;
  const params: string[] = [];
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
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY domain, key`;

  const res = await pool.query(sql, params);
  if (!domain) {
    return res.rows.map((row: any) => ({
      ...row,
      content: row.content?.length > 80 ? row.content.slice(0, 80) : row.content,
    }));
  }
  return res.rows;
}

/**
 * 도메인 목록 조회 (통계 포함)
 */
export async function listDomains(): Promise<KBDomain[]> {
  const sql = `
    SELECT o.domain, o.description, COUNT(k.kb_id) as entry_count
    FROM semo.ontology o
    LEFT JOIN semo.knowledge_base k ON o.domain = k.domain
    GROUP BY o.domain, o.description
    ORDER BY o.domain
  `;
  const res = await pool.query(sql);
  return res.rows;
}

/**
 * 특정 KB 항목 조회
 */
export async function getItem(
  domain: string,
  key: string
): Promise<KBItem | null> {
  const sql = `
    SELECT kb_id, domain, key, content, metadata, created_by, updated_at
    FROM semo.knowledge_base
    WHERE domain = $1 AND key = $2
  `;
  const res = await pool.query(sql, [domain, key]);
  return res.rows[0] || null;
}

/**
 * KB 항목 upsert (domain + key 기준)
 */
export async function upsertItem(
  domain: string,
  key: string,
  content: string,
  createdBy?: string
): Promise<KBItem> {
  // Domain validation: check ontology before write
  const domainCheck = await pool.query(
    'SELECT 1 FROM semo.ontology WHERE domain = $1',
    [domain]
  );
  if (domainCheck.rows.length === 0) {
    const knownDomains = await pool.query('SELECT domain FROM semo.ontology ORDER BY domain');
    const known = knownDomains.rows.map((r: { domain: string }) => r.domain);
    throw new Error(`도메인 '${domain}'은(는) 온톨로지에 등록되지 않았습니다. 등록된 도메인: [${known.join(', ')}]`);
  }

  const sql = `
    INSERT INTO semo.knowledge_base (domain, key, content, created_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (domain, key) DO UPDATE SET
      content    = EXCLUDED.content,
      updated_at = NOW()
    RETURNING kb_id, domain, key, content, created_by, updated_at
  `;
  const res = await pool.query(sql, [domain, key, content, createdBy ?? 'dashboard']);
  const item = res.rows[0];

  // 임베딩 자동 생성 (best-effort: 실패해도 본 upsert는 성공)
  if (process.env.OPENAI_API_KEY) {
    try {
      const embedding = await genEmbedding(content);
      const embeddingStr = '[' + embedding.join(',') + ']';
      await pool.query(
        'UPDATE semo.knowledge_base SET embedding = $1::vector WHERE kb_id = $2',
        [embeddingStr, item.kb_id]
      );
    } catch (e) {
      console.warn(`[kb] embedding generation failed for ${domain}/${key}:`, e);
    }
  }

  return item;
}

/**
 * KB 항목 삭제
 */
export async function deleteItemByKey(domain: string, key: string): Promise<boolean> {
  const res = await pool.query(
    'DELETE FROM semo.knowledge_base WHERE domain = $1 AND key = $2',
    [domain, key]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * 전체 KB 통계
 */
export async function stats(): Promise<KBStats> {
  const kbByDomain = await pool.query(
    `SELECT domain, count(*) as cnt, count(embedding) as emb_cnt
     FROM semo.knowledge_base
     GROUP BY domain
     ORDER BY domain`
  );

  const totKb = await pool.query(
    'SELECT count(*) as total, count(embedding) as emb FROM semo.knowledge_base'
  );

  return {
    knowledge_base: {
      total: totKb.rows[0].total,
      emb: totKb.rows[0].emb,
      by_domain: kbByDomain.rows,
    },
  };
}
