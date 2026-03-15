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
  bot_knowledge: {
    total: string;
    emb: string;
    by_bot: Array<{
      bot_id: string;
      cnt: string;
      emb_cnt: string;
    }>;
  };
}

/**
 * 시맨틱 검색 (Voyage-3 임베딩 + pgvector)
 */
export async function search(
  query: string,
  limit: number = 10,
  botId?: string
): Promise<KBItem[]> {
  const embedding = await genEmbedding(query);
  const embeddingStr = '[' + embedding.join(',') + ']';

  let sql: string;
  let params: any[];

  if (botId) {
    // 봇별 KB 검색
    sql = `
      SELECT id as kb_id, bot_id, domain, key, content,
             ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
      FROM semo.bot_knowledge
      WHERE bot_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    params = [embeddingStr, botId, limit];
  } else {
    // 전체 KB 검색
    sql = `
      SELECT kb_id, domain, key, content,
             ROUND((1 - (embedding <=> $1::vector))::numeric * 100, 1) as similarity_pct
      FROM semo.knowledge_base
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;
    params = [embeddingStr, limit];
  }

  const res = await pool.query(sql, params);
  return res.rows;
}

/**
 * KB 목록 조회 (domain 또는 bot_id 필터 지원)
 */
export async function list(
  domain?: string,
  botId?: string
): Promise<KBItem[]> {
  if (botId) {
    // 봇별 KB 목록
    const sql = `
      SELECT id as kb_id, bot_id, domain, key, LEFT(content, 80) as content
      FROM semo.bot_knowledge
      WHERE bot_id = $1
      ORDER BY domain, key
    `;
    const res = await pool.query(sql, [botId]);
    return res.rows;
  } else if (domain) {
    // 도메인별 KB 목록
    const sql = `
      SELECT kb_id, domain, key, LEFT(content, 80) as content, created_by
      FROM semo.knowledge_base
      WHERE domain = $1
      ORDER BY key
    `;
    const res = await pool.query(sql, [domain]);
    return res.rows;
  } else {
    // 전체 KB 목록
    const sql = `
      SELECT kb_id, domain, key, LEFT(content, 80) as content, created_by
      FROM semo.knowledge_base
      ORDER BY domain, key
    `;
    const res = await pool.query(sql);
    return res.rows;
  }
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
  key: string,
  botId?: string
): Promise<KBItem | null> {
  if (botId) {
    // 봇별 KB 항목
    const sql = `
      SELECT id as kb_id, bot_id, domain, key, content, metadata, updated_at
      FROM semo.bot_knowledge
      WHERE bot_id = $1 AND domain = $2 AND key = $3
    `;
    const res = await pool.query(sql, [botId, domain, key]);
    return res.rows[0] || null;
  } else {
    // 전체 KB 항목
    const sql = `
      SELECT kb_id, domain, key, content, metadata, created_by, updated_at
      FROM semo.knowledge_base
      WHERE domain = $1 AND key = $2
    `;
    const res = await pool.query(sql, [domain, key]);
    return res.rows[0] || null;
  }
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

  const bkByBot = await pool.query(
    `SELECT bot_id, count(*) as cnt, count(embedding) as emb_cnt
     FROM semo.bot_knowledge
     GROUP BY bot_id
     ORDER BY bot_id`
  );

  const totKb = await pool.query(
    'SELECT count(*) as total, count(embedding) as emb FROM semo.knowledge_base'
  );

  const totBk = await pool.query(
    'SELECT count(*) as total, count(embedding) as emb FROM semo.bot_knowledge'
  );

  return {
    knowledge_base: {
      total: totKb.rows[0].total,
      emb: totKb.rows[0].emb,
      by_domain: kbByDomain.rows,
    },
    bot_knowledge: {
      total: totBk.rows[0].total,
      emb: totBk.rows[0].emb,
      by_bot: bkByBot.rows,
    },
  };
}
