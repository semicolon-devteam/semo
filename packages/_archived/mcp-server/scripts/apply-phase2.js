#!/usr/bin/env node
/**
 * SEMO Long-Term Memory - Phase 2 적용 스크립트
 *
 * 사용법:
 *   node scripts/apply-phase2.js
 *   (또는 환경변수로 오버라이드: DB_HOST=... DB_PASSWORD=... node scripts/apply-phase2.js)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// .env.local 파일에서 설정 읽기
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// 환경변수 로드
loadEnvFile();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || '',
  connectionTimeoutMillis: 10000,
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(icon, message, color = colors.reset) {
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

async function applyPhase2() {
  const pool = new Pool(config);
  const client = await pool.connect();

  try {
    log('🚀', 'Phase 2: SEMO 벡터 임베딩 파이프라인 적용 (부분)', colors.cyan);
    console.log('');

    // 1. embedding_requests 테이블 생성
    log('📦', 'Step 1: embedding_requests 테이블 생성...', colors.blue);
    await client.query(`
      CREATE TABLE IF NOT EXISTS semo.embedding_requests (
        request_id BIGSERIAL PRIMARY KEY,
        memory_id BIGINT REFERENCES semo.semantic_memory(memory_id),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count INT DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
    log('✅', 'embedding_requests 테이블 생성 완료', colors.green);
    console.log('');

    // 2. embedding_requests 인덱스
    log('📦', 'Step 2: embedding_requests 인덱스 생성...', colors.blue);
    await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_requests_status ON semo.embedding_requests(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_requests_memory ON semo.embedding_requests(memory_id)');
    log('✅', 'embedding_requests 인덱스 생성 완료', colors.green);
    console.log('');

    // 3. pg_trgm 텍스트 검색 인덱스
    log('📦', 'Step 3: pg_trgm 텍스트 검색 인덱스 생성...', colors.blue);
    await client.query('CREATE INDEX IF NOT EXISTS idx_semantic_memory_text_trgm ON semo.semantic_memory USING gin (memory_text gin_trgm_ops)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_interaction_logs_content_trgm ON semo.interaction_logs USING gin (content gin_trgm_ops)');
    log('✅', 'pg_trgm 인덱스 생성 완료', colors.green);
    console.log('');

    // 4. 텍스트 검색 함수 생성
    log('📦', 'Step 4: 텍스트 검색 함수 생성...', colors.blue);
    await client.query(`
      CREATE OR REPLACE FUNCTION semo.text_search_memory(
        p_user_id UUID,
        p_search_text TEXT,
        p_limit INT DEFAULT 10,
        p_similarity_threshold FLOAT DEFAULT 0.3
      )
      RETURNS TABLE (
        memory_id BIGINT,
        memory_text TEXT,
        memory_type VARCHAR(50),
        similarity FLOAT,
        importance_score FLOAT,
        created_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          sm.memory_id,
          sm.memory_text,
          sm.memory_type,
          similarity(sm.memory_text, p_search_text) as similarity,
          sm.importance_score,
          sm.created_at
        FROM semo.semantic_memory sm
        WHERE sm.user_id = p_user_id
          AND similarity(sm.memory_text, p_search_text) > p_similarity_threshold
        ORDER BY similarity DESC, sm.importance_score DESC
        LIMIT p_limit;
      END;
      $$
    `);
    log('✅', 'text_search_memory 함수 생성 완료', colors.green);
    console.log('');

    // 5. 메모리 생성 함수
    log('📦', 'Step 5: 메모리 생성 함수 생성...', colors.blue);
    await client.query(`
      CREATE OR REPLACE FUNCTION semo.create_memory(
        p_user_id UUID,
        p_memory_text TEXT,
        p_memory_type VARCHAR(50) DEFAULT 'semantic',
        p_source_log_ids BIGINT[] DEFAULT NULL,
        p_importance_score FLOAT DEFAULT 1.0
      )
      RETURNS BIGINT
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_memory_id BIGINT;
      BEGIN
        INSERT INTO semo.semantic_memory (
          user_id, memory_text, memory_type, source_log_ids, importance_score
        )
        VALUES (
          p_user_id, p_memory_text, p_memory_type, p_source_log_ids, p_importance_score
        )
        RETURNING memory_id INTO v_memory_id;

        -- 임베딩 요청 생성 (나중에 벡터화)
        INSERT INTO semo.embedding_requests (memory_id, status)
        VALUES (v_memory_id, 'pending');

        RETURN v_memory_id;
      END;
      $$
    `);
    log('✅', 'create_memory 함수 생성 완료', colors.green);
    console.log('');

    // 6. 메모리 접근 함수 (access_count 증가)
    log('📦', 'Step 6: 메모리 접근 함수 생성...', colors.blue);
    // 기존 함수 삭제 (리턴 타입 변경 불가하므로)
    await client.query('DROP FUNCTION IF EXISTS semo.access_memory(BIGINT)');
    await client.query(`
      CREATE OR REPLACE FUNCTION semo.access_memory(
        p_memory_id BIGINT
      )
      RETURNS TABLE (
        memory_id BIGINT,
        user_id UUID,
        memory_text TEXT,
        source_log_ids BIGINT[],
        memory_type VARCHAR(50),
        importance_score FLOAT,
        access_count INT,
        last_accessed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        UPDATE semo.semantic_memory sm
        SET
          access_count = sm.access_count + 1,
          last_accessed_at = NOW()
        WHERE sm.memory_id = p_memory_id
        RETURNING
          sm.memory_id,
          sm.user_id,
          sm.memory_text,
          sm.source_log_ids,
          sm.memory_type,
          sm.importance_score,
          sm.access_count,
          sm.last_accessed_at,
          sm.created_at;
      END;
      $$
    `);
    log('✅', 'access_memory 함수 생성 완료', colors.green);
    console.log('');

    // 검증
    log('📋', 'Phase 2 검증...', colors.cyan);

    // 테이블 확인
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'semo'
      ORDER BY table_name
    `);
    console.log('   테이블:', tablesResult.rows.map(r => r.table_name).join(', '));

    // 함수 확인
    const functionsResult = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'semo'
      ORDER BY routine_name
    `);
    console.log('   함수:', functionsResult.rows.map(r => r.routine_name).join(', '));

    // 인덱스 확인
    const indexResult = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'semo'
      ORDER BY indexname
    `);
    console.log('   인덱스:', indexResult.rows.map(r => r.indexname).join(', '));

    console.log('');
    log('🎉', 'Phase 2 (부분) 적용 완료!', colors.green);
    console.log('');
    log('⚠️', 'pgvector 확장이 없어 벡터 검색은 제외됨', colors.yellow);
    console.log('   → Docker 이미지에 pgvector 설치 후 Phase 2.5로 추가 예정');
    console.log('');

  } catch (error) {
    log('❌', `오류 발생: ${error.message}`, colors.red);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});

// 실행
applyPhase2().catch((err) => {
  console.error(err);
  process.exit(1);
});
