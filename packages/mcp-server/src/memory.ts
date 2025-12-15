/**
 * SEMO Long-Term Memory Module
 *
 * PostgreSQL 기반 장기 기억 시스템 연동
 * - 백그라운드 로깅 (자동)
 * - 명시적 메모리 저장/검색 (MCP Tools)
 */

import { Pool } from 'pg';
import { decrypt } from './crypto.js';

// 암호화된 토큰 로드
function loadEncryptedDbPassword(): string {
  try {
    // CI/CD에서 생성된 암호화 토큰 (배포 패키지용)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require('./tokens.generated.js');
    if (generated.ENCRYPTED_TOKENS?.DB_PASSWORD) {
      const decrypted = decrypt(generated.ENCRYPTED_TOKENS.DB_PASSWORD);
      if (decrypted) return decrypted;
    }
  } catch {
    // tokens.generated.js 없음 - 로컬 개발 환경
  }
  return '';
}

// DB 비밀번호 가져오기 (우선순위: 환경변수 > 암호화된 팀 토큰)
function getDbPassword(): string {
  // 1. 환경변수 우선 (로컬 개발/테스트용)
  if (process.env.SEMO_DB_PASSWORD) {
    return process.env.SEMO_DB_PASSWORD;
  }
  // 2. 암호화된 팀 토큰 (배포 패키지용)
  return loadEncryptedDbPassword();
}

// DB 설정 (환경변수 또는 기본값)
const DB_CONFIG = {
  host: process.env.SEMO_DB_HOST || '3.38.162.21',
  port: parseInt(process.env.SEMO_DB_PORT || '5432'),
  database: process.env.SEMO_DB_NAME || 'appdb',
  user: process.env.SEMO_DB_USER || 'app',
  password: getDbPassword(),
  max: 5, // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Connection Pool (싱글톤)
let pool: Pool | null = null;

/**
 * DB Pool 가져오기 (Lazy initialization)
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);

    pool.on('error', (err) => {
      console.error('[SEMO Memory] Pool error:', err.message);
    });
  }
  return pool;
}

/**
 * DB 연결 종료
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * DB 연결 가능 여부 확인
 */
export function isMemoryEnabled(): boolean {
  return !!DB_CONFIG.password;
}

// ============================================
// 백그라운드 로깅 (Option A: 자동)
// ============================================

/**
 * 상호작용 로그 저장 (비동기, fire-and-forget)
 */
export async function logInteraction(params: {
  userId: string;
  sessionId: string;
  agentId?: string;
  role: 'user' | 'assistant';
  content: string;
  skillName?: string;
  skillArgs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isMemoryEnabled()) return;

  try {
    const pool = getPool();
    // agent_id: 기본값으로 SEMO MCP 에이전트 ID 사용
    const agentId = params.agentId || '00000000-0000-0000-0000-000000000000';
    await pool.query(`
      INSERT INTO semo.interaction_logs
        (user_id, session_id, agent_id, role, content, skill_name, skill_args, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      params.userId,
      params.sessionId,
      agentId,
      params.role,
      params.content,
      params.skillName || null,
      params.skillArgs ? JSON.stringify(params.skillArgs) : null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);
  } catch (error) {
    // 백그라운드 로깅 실패는 무시 (메인 플로우에 영향 없음)
    console.error('[SEMO Memory] Log failed:', (error as Error).message);
  }
}

/**
 * 세션 시작/업데이트
 */
export async function upsertSession(params: {
  sessionId: string;
  userId: string;
  projectPath?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isMemoryEnabled()) return;

  try {
    const pool = getPool();
    await pool.query(`
      INSERT INTO semo.sessions (session_id, user_id, project_path, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (session_id) DO UPDATE SET
        project_path = COALESCE(EXCLUDED.project_path, semo.sessions.project_path),
        metadata = COALESCE(EXCLUDED.metadata, semo.sessions.metadata)
    `, [
      params.sessionId,
      params.userId,
      params.projectPath || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);
  } catch (error) {
    console.error('[SEMO Memory] Session upsert failed:', (error as Error).message);
  }
}

// ============================================
// 명시적 메모리 (Option B: MCP Tools)
// ============================================

export interface MemorySearchResult {
  memoryId: number;
  memoryText: string;
  memoryType: string;
  similarity: number;
}

/**
 * 중요 정보를 시맨틱 메모리에 저장
 */
export async function rememberFact(params: {
  userId: string;
  text: string;
  type?: 'episodic' | 'semantic' | 'procedural';
  importance?: number;
}): Promise<number | null> {
  if (!isMemoryEnabled()) return null;

  try {
    const pool = getPool();
    const result = await pool.query<{ memory_id: number }>(`
      SELECT semo.create_memory($1, $2, $3, NULL, $4) as memory_id
    `, [
      params.userId,
      params.text,
      params.type || 'semantic',
      params.importance || 1.0,
    ]);

    return result.rows[0]?.memory_id || null;
  } catch (error) {
    console.error('[SEMO Memory] Remember failed:', (error as Error).message);
    return null;
  }
}

/**
 * 텍스트 유사도 검색 (pg_trgm)
 */
export async function searchByText(params: {
  userId: string;
  query: string;
  limit?: number;
}): Promise<MemorySearchResult[]> {
  if (!isMemoryEnabled()) return [];

  try {
    const pool = getPool();
    const result = await pool.query<MemorySearchResult>(`
      SELECT
        memory_id as "memoryId",
        memory_text as "memoryText",
        memory_type as "memoryType",
        similarity
      FROM semo.text_search($1, $2, $3)
    `, [
      params.userId,
      params.query,
      params.limit || 10,
    ]);

    // 접근 기록 업데이트
    for (const row of result.rows) {
      await pool.query('SELECT semo.access_memory($1)', [row.memoryId]);
    }

    return result.rows;
  } catch (error) {
    console.error('[SEMO Memory] Text search failed:', (error as Error).message);
    return [];
  }
}

/**
 * 하이브리드 검색 (벡터 + 텍스트) - 벡터 임베딩이 있는 경우
 * 현재는 텍스트 검색만 지원 (임베딩 파이프라인 추가 필요)
 */
export async function searchMemory(params: {
  userId: string;
  query: string;
  limit?: number;
}): Promise<MemorySearchResult[]> {
  // 현재는 텍스트 검색으로 폴백
  return searchByText(params);
}

/**
 * 사용자 팩트 저장
 */
export async function saveUserFact(params: {
  userId: string;
  factKey: string;
  factValue: string;
  category?: string;
}): Promise<void> {
  if (!isMemoryEnabled()) return;

  try {
    const pool = getPool();
    await pool.query(`
      INSERT INTO semo.user_facts (user_id, key, value, category)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        category = COALESCE(EXCLUDED.category, semo.user_facts.category),
        updated_at = NOW()
    `, [
      params.userId,
      params.factKey,
      params.factValue,
      params.category || 'general',
    ]);
  } catch (error) {
    console.error('[SEMO Memory] Save fact failed:', (error as Error).message);
  }
}

/**
 * 사용자 팩트 조회
 */
export async function getUserFacts(params: {
  userId: string;
  category?: string;
}): Promise<Array<{ key: string; value: string; category: string }>> {
  if (!isMemoryEnabled()) return [];

  try {
    const pool = getPool();
    let query = `
      SELECT key, value, category
      FROM semo.user_facts
      WHERE user_id = $1
    `;
    const queryParams: string[] = [params.userId];

    if (params.category) {
      query += ` AND category = $2`;
      queryParams.push(params.category);
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await pool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    console.error('[SEMO Memory] Get facts failed:', (error as Error).message);
    return [];
  }
}

/**
 * 최근 상호작용 조회
 */
export async function getRecentInteractions(params: {
  userId: string;
  sessionId?: string;
  limit?: number;
}): Promise<Array<{
  role: string;
  content: string;
  skillName: string | null;
  createdAt: Date;
}>> {
  if (!isMemoryEnabled()) return [];

  try {
    const pool = getPool();
    let query = `
      SELECT role, content, skill_name as "skillName", created_at as "createdAt"
      FROM semo.interaction_logs
      WHERE user_id = $1
    `;
    const queryParams: (string | number)[] = [params.userId];
    let paramIndex = 2;

    if (params.sessionId) {
      query += ` AND session_id = $${paramIndex}`;
      queryParams.push(params.sessionId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(params.limit || 20);

    const result = await pool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    console.error('[SEMO Memory] Get interactions failed:', (error as Error).message);
    return [];
  }
}

// ============================================
// 임베딩 파이프라인 (Phase 2)
// ============================================

/**
 * OpenAI API로 텍스트 임베딩 생성
 */
async function createEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // 최대 8000자
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SEMO Memory] Embedding API error:', error);
      return null;
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0]?.embedding || null;
  } catch (error) {
    console.error('[SEMO Memory] Embedding failed:', (error as Error).message);
    return null;
  }
}

/**
 * 대기 중인 임베딩 요청 처리
 */
export async function processPendingEmbeddings(params: {
  openaiApiKey: string;
  limit?: number;
}): Promise<{ processed: number; failed: number }> {
  if (!isMemoryEnabled()) return { processed: 0, failed: 0 };

  const pool = getPool();
  let processed = 0;
  let failed = 0;

  try {
    // 대기 중인 요청 조회
    const pending = await pool.query<{
      request_id: number;
      memory_id: number;
      memory_text: string;
    }>(`
      SELECT er.request_id, er.memory_id, sm.memory_text
      FROM semo.embedding_requests er
      JOIN semo.semantic_memory sm ON er.memory_id = sm.memory_id
      WHERE er.status = 'pending'
      ORDER BY er.created_at
      LIMIT $1
    `, [params.limit || 10]);

    for (const row of pending.rows) {
      // 임베딩 생성
      const embedding = await createEmbedding(row.memory_text, params.openaiApiKey);

      if (embedding) {
        // 임베딩 저장
        await pool.query(`
          UPDATE semo.semantic_memory
          SET embedding = $1::vector
          WHERE memory_id = $2
        `, [`[${embedding.join(',')}]`, row.memory_id]);

        // 요청 완료 처리
        await pool.query(`
          UPDATE semo.embedding_requests
          SET status = 'completed', completed_at = NOW()
          WHERE request_id = $1
        `, [row.request_id]);

        processed++;
      } else {
        // 실패 처리
        await pool.query(`
          UPDATE semo.embedding_requests
          SET status = 'failed', retry_count = retry_count + 1, error_message = 'Embedding API failed'
          WHERE request_id = $1
        `, [row.request_id]);

        failed++;
      }
    }
  } catch (error) {
    console.error('[SEMO Memory] Process embeddings failed:', (error as Error).message);
  }

  return { processed, failed };
}

/**
 * 벡터 유사도 검색 (임베딩 기반)
 */
export async function searchByVector(params: {
  userId: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<MemorySearchResult[]> {
  if (!isMemoryEnabled()) return [];

  try {
    const pool = getPool();
    const result = await pool.query<MemorySearchResult>(`
      SELECT
        memory_id as "memoryId",
        memory_text as "memoryText",
        memory_type as "memoryType",
        (1 - (embedding <=> $2::vector))::FLOAT AS similarity
      FROM semo.semantic_memory
      WHERE user_id = $1
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector
      LIMIT $3
    `, [
      params.userId,
      `[${params.queryEmbedding.join(',')}]`,
      params.limit || 10,
    ]);

    // 접근 기록 업데이트
    for (const row of result.rows) {
      await pool.query('SELECT semo.access_memory($1)', [row.memoryId]);
    }

    return result.rows;
  } catch (error) {
    console.error('[SEMO Memory] Vector search failed:', (error as Error).message);
    return [];
  }
}

/**
 * 하이브리드 검색 (벡터 + 텍스트)
 */
export async function searchHybrid(params: {
  userId: string;
  query: string;
  queryEmbedding: number[];
  limit?: number;
  vectorWeight?: number;
}): Promise<MemorySearchResult[]> {
  if (!isMemoryEnabled()) return [];

  try {
    const pool = getPool();
    const result = await pool.query<MemorySearchResult>(`
      SELECT
        memory_id as "memoryId",
        memory_text as "memoryText",
        memory_type as "memoryType",
        combined_score as similarity
      FROM semo.hybrid_search($1, $2, $3::vector, $4, $5)
    `, [
      params.userId,
      params.query,
      `[${params.queryEmbedding.join(',')}]`,
      params.limit || 10,
      params.vectorWeight || 0.7,
    ]);

    // 접근 기록 업데이트
    for (const row of result.rows) {
      await pool.query('SELECT semo.access_memory($1)', [row.memoryId]);
    }

    return result.rows;
  } catch (error) {
    console.error('[SEMO Memory] Hybrid search failed:', (error as Error).message);
    // 벡터 검색 실패 시 텍스트 검색으로 폴백
    return searchByText({ userId: params.userId, query: params.query, limit: params.limit });
  }
}

/**
 * 쿼리 임베딩 생성 후 하이브리드 검색
 */
export async function searchMemoryWithEmbedding(params: {
  userId: string;
  query: string;
  openaiApiKey: string;
  limit?: number;
}): Promise<MemorySearchResult[]> {
  // 쿼리 임베딩 생성
  const queryEmbedding = await createEmbedding(params.query, params.openaiApiKey);

  if (queryEmbedding) {
    // 하이브리드 검색
    return searchHybrid({
      userId: params.userId,
      query: params.query,
      queryEmbedding,
      limit: params.limit,
    });
  }

  // 임베딩 실패 시 텍스트 검색으로 폴백
  return searchByText(params);
}

/**
 * 시스템 상태 조회
 */
export async function getSystemStatus(): Promise<Record<string, number> | null> {
  if (!isMemoryEnabled()) return null;

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT metric_name, metric_value::int
      FROM semo.get_system_status()
    `);

    const status: Record<string, number> = {};
    for (const row of result.rows) {
      status[row.metric_name] = row.metric_value;
    }
    return status;
  } catch (error) {
    console.error('[SEMO Memory] Get status failed:', (error as Error).message);
    return null;
  }
}
