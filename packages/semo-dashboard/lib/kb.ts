/**
 * @file lib/kb.ts
 * @description Knowledge Base 라이브러리. PostgreSQL + pgvector를 사용한 시맨틱 검색 및 CRUD.
 *   팀 공용 KB(`semo.knowledge_base`)와 봇별 KB(`semo.bot_knowledge`)를 모두 지원한다.
 * @dependencies pg, lib/voyage.ts (임베딩 생성), DATABASE_URL 환경변수
 * @usage
 *   import { search, list, upsertItem } from '@/lib/kb';
 *   const results = await search('배포 프로세스', 10);
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

/** semo.knowledge_base / semo.bot_knowledge 행 형태 */
export interface KBItem {
  /** 행 고유 ID */
  kb_id: number;
  /** KB 도메인 카테고리 */
  domain: string;
  /** 도메인 내 고유 키 */
  key: string;
  /** KB 항목 내용 (마크다운 텍스트) */
  content: string;
  /** 추가 메타데이터 (JSONB) */
  metadata?: Record<string, unknown>;
  /** 항목 생성자 (봇 ID 또는 'dashboard') */
  created_by?: string;
  /** 마지막 수정 ISO 타임스탬프 */
  updated_at?: string;
  /** 코사인 유사도 백분율 (0-100, 검색 결과에만 존재) */
  similarity_pct?: number;
}

/** 도메인 정보 + 항목 수 */
export interface KBDomain {
  /** 도메인 이름 */
  domain: string;
  /** 도메인 설명 */
  description?: string;
  /** 해당 도메인의 KB 항목 수 */
  entry_count: number;
}

/** KB 전체 통계 응답 형태 */
export interface KBStats {
  knowledge_base: {
    /** 전체 항목 수 */
    total: string;
    /** 임베딩이 있는 항목 수 */
    emb: string;
    /** 도메인별 통계 */
    by_domain: Array<{
      domain: string;
      cnt: string;
      emb_cnt: string;
    }>;
  };
  bot_knowledge: {
    /** 전체 봇 KB 항목 수 */
    total: string;
    /** 임베딩이 있는 항목 수 */
    emb: string;
    /** 봇별 통계 */
    by_bot: Array<{
      bot_id: string;
      cnt: string;
      emb_cnt: string;
    }>;
  };
}

/**
 * KB 시맨틱 검색 (Voyage-3 임베딩 + pgvector 코사인 유사도).
 *
 * @param query - 검색 쿼리 텍스트
 * @param limit - 최대 반환 건수 (기본값: 10)
 * @param botId - 봇 ID 지정 시 해당 봇 KB만 검색, 미지정 시 전체 팀 KB 검색
 * @returns 유사도 내림차순 KBItem 배열
 * @throws {Error} 임베딩 생성 실패(OPENAI_API_KEY 없음) 또는 DB 오류
 */
export async function search(
  query: string,
  limit: number = 10,
  botId?: string
): Promise<KBItem[]> {
  const embedding = await genEmbedding(query);
  const embeddingStr = '[' + embedding.join(',') + ']';

  let sql: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * KB 목록 조회. domain 또는 bot_id로 필터링할 수 있다.
 *
 * @param domain - 도메인 필터 (미지정 시 전체)
 * @param botId - 봇 ID 필터 (지정 시 semo.bot_knowledge 조회, 미지정 시 semo.knowledge_base)
 * @returns KBItem 배열 (content는 80자로 잘림)
 * @throws {Error} DB 연결 오류
 */
export async function list(
  domain?: string,
  botId?: string
): Promise<KBItem[]> {
  if (botId) {
    // 봇별 KB 목록
    const sql = `
      SELECT id as kb_id, bot_id, domain, key, content, updated_at
      FROM semo.bot_knowledge
      WHERE bot_id = $1
      ORDER BY domain, key
    `;
    const res = await pool.query(sql, [botId]);
    return res.rows;
  } else if (domain) {
    // 도메인별 KB 목록
    const sql = `
      SELECT kb_id, domain, key, content, created_by, updated_at
      FROM semo.knowledge_base
      WHERE domain = $1
      ORDER BY key
    `;
    const res = await pool.query(sql, [domain]);
    return res.rows;
  } else {
    // 전체 KB 목록
    const sql = `
      SELECT kb_id, domain, key, content, created_by, updated_at
      FROM semo.knowledge_base
      ORDER BY domain, key
    `;
    const res = await pool.query(sql);
    return res.rows;
  }
}

/** semo.ontology 행 + KB 항목 수 */
export interface OntologyDomain {
  domain: string;
  description: string | null;
  version: number;
  entry_count: number;
  schema: Record<string, unknown>;
}

/**
 * 온톨로지 도메인 목록을 schema/version 포함하여 조회한다.
 *
 * @returns OntologyDomain 배열
 * @throws {Error} DB 연결 오류
 */
export async function listOntology(): Promise<OntologyDomain[]> {
  const sql = `
    SELECT o.domain, o.description, o.version, o.schema,
           COUNT(k.kb_id) as entry_count
    FROM semo.ontology o
    LEFT JOIN semo.knowledge_base k ON o.domain = k.domain
    GROUP BY o.domain, o.description, o.version, o.schema
    ORDER BY o.domain
  `;
  const res = await pool.query(sql);
  return res.rows;
}

/**
 * 도메인 목록을 통계와 함께 조회한다.
 *
 * @returns KBDomain 배열 (semo.ontology 기준, 항목 수 포함)
 * @throws {Error} DB 연결 오류
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
 * 특정 KB 항목을 조회한다.
 *
 * @param domain - 도메인 이름
 * @param key - 항목 키
 * @param botId - 봇 ID 지정 시 semo.bot_knowledge에서 조회
 * @returns KBItem 또는 없으면 null
 * @throws {Error} DB 연결 오류
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
 * KB 항목을 생성하거나 업데이트한다. (domain + key 기준 upsert)
 *
 * @param domain - 도메인 이름
 * @param key - 항목 키
 * @param content - 항목 내용 (마크다운 텍스트)
 * @param createdBy - 생성자 ID (기본값: 'dashboard')
 * @returns 저장된 KBItem
 * @throws {Error} DB 연결 오류 또는 제약 위반
 */
export async function upsertItem(
  domain: string,
  key: string,
  content: string,
  createdBy?: string
): Promise<KBItem> {
  const sql = `
    INSERT INTO semo.knowledge_base (domain, key, content, created_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (domain, key) DO UPDATE SET
      content    = EXCLUDED.content,
      updated_at = NOW()
    RETURNING kb_id, domain, key, content, created_by, updated_at
  `;
  const res = await pool.query(sql, [domain, key, content, createdBy ?? 'dashboard']);
  return res.rows[0];
}

/**
 * KB 항목을 삭제한다.
 *
 * @param domain - 도메인 이름
 * @param key - 항목 키
 * @returns 삭제 성공 시 true, 항목이 없으면 false
 * @throws {Error} DB 연결 오류
 */
export async function deleteItemByKey(domain: string, key: string): Promise<boolean> {
  const res = await pool.query(
    'DELETE FROM semo.knowledge_base WHERE domain = $1 AND key = $2',
    [domain, key]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * 전체 KB 통계를 반환한다.
 * (팀 KB 도메인별, 봇 KB 봇별 항목 수 + 임베딩 수)
 *
 * @returns KBStats 객체
 * @throws {Error} DB 연결 오류
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
