# PostgreSQL 기반 장기 기억 시스템 단계적 적용 플랜

> SEMO Long-term Memory System Implementation Roadmap

---

## 개요

이 문서는 [PostgreSQL 기반 장기 기억 아키텍처 보고서](./POSTGRESQL_BASED_LONG_TERM_MEMORY_REPORT.md)를 실제 프로덕션에 적용하기 위한 단계적 구현 계획입니다.

### 목표

- **Phase 1-2**: 기본 인프라 구축 (MVP)
- **Phase 3-4**: 지능형 기억 시스템 구현
- **Phase 5-6**: 보안 강화 및 최적화

### 전체 타임라인 개요

```
Phase 1: 스키마 및 기본 로깅        ████████░░░░░░░░░░░░░░░░░░░░░░
Phase 2: 벡터 임베딩 파이프라인      ░░░░░░░░████████░░░░░░░░░░░░░░
Phase 3: 기억 통합 (pg_cron)        ░░░░░░░░░░░░░░░░████████░░░░░░
Phase 4: 하이브리드 검색             ░░░░░░░░░░░░░░░░░░░░░░░░████░░
Phase 5: 보안 강화                   ░░░░░░░░░░░░░░░░░░░░░░░░░░████
Phase 6: 모니터링 및 최적화          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░██
```

---

## Phase 1: 스키마 및 기본 로깅

### 목표

- PostgreSQL 확장 설치
- 핵심 테이블 스키마 생성
- 기본 상호작용 로깅 구현

### 작업 항목

#### 1.1 PostgreSQL 확장 설치

```sql
-- core-supabase에서 실행
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_net;        -- 비동기 HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;       -- 스케줄링
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- 텍스트 유사도
```

**검증**:
```sql
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_net', 'pg_cron', 'pg_trgm');
```

#### 1.2 핵심 테이블 생성

```sql
-- 1. 상호작용 로그 (Episodic Memory)
CREATE TABLE semo.interaction_logs (
    log_id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    skill_name VARCHAR(255),
    skill_args JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 시맨틱 메모리 (Vector Store)
CREATE TABLE semo.semantic_memory (
    memory_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    memory_text TEXT NOT NULL,
    embedding vector(1536),
    source_log_ids BIGINT[],
    memory_type VARCHAR(50) CHECK (memory_type IN ('episodic', 'semantic', 'procedural')),
    importance_score FLOAT DEFAULT 1.0,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 사용자 팩트 (Structured Knowledge)
CREATE TABLE semo.user_facts (
    fact_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    category VARCHAR(50),
    key VARCHAR(100),
    value TEXT,
    confidence_score FLOAT DEFAULT 1.0,
    derived_from_log_id BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, key)
);

-- 4. 세션 메타데이터
CREATE TABLE semo.sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_path TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    summary TEXT,
    metadata JSONB DEFAULT '{}'
);
```

#### 1.3 기본 인덱스 생성

```sql
-- 상호작용 로그 인덱스
CREATE INDEX idx_interaction_logs_session ON semo.interaction_logs(session_id);
CREATE INDEX idx_interaction_logs_user ON semo.interaction_logs(user_id);
CREATE INDEX idx_interaction_logs_created ON semo.interaction_logs(created_at DESC);
CREATE INDEX idx_interaction_logs_skill ON semo.interaction_logs(skill_name);

-- 시맨틱 메모리 인덱스 (벡터는 Phase 2에서)
CREATE INDEX idx_semantic_memory_user ON semo.semantic_memory(user_id);
CREATE INDEX idx_semantic_memory_type ON semo.semantic_memory(memory_type);

-- 사용자 팩트 인덱스
CREATE INDEX idx_user_facts_category ON semo.user_facts(user_id, category);
```

#### 1.4 MCP 서버 로깅 통합

**수정 대상**: `packages/mcp-server/src/index.ts`

```typescript
// 상호작용 로깅 함수
async function logInteraction(
  sessionId: string,
  userId: string,
  agentId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  skillName?: string,
  skillArgs?: Record<string, unknown>
) {
  await supabase.from('semo.interaction_logs').insert({
    session_id: sessionId,
    user_id: userId,
    agent_id: agentId,
    role,
    content,
    skill_name: skillName,
    skill_args: skillArgs,
    metadata: { version: '1.0.0' }
  });
}
```

### 검증 체크리스트

- [ ] 모든 PostgreSQL 확장 설치 확인
- [ ] 4개 테이블 생성 확인
- [ ] 인덱스 생성 확인
- [ ] MCP 서버에서 테스트 로그 삽입 성공
- [ ] 로그 조회 쿼리 동작 확인

### 롤백 계획

```sql
-- Phase 1 롤백
DROP TABLE IF EXISTS semo.sessions CASCADE;
DROP TABLE IF EXISTS semo.user_facts CASCADE;
DROP TABLE IF EXISTS semo.semantic_memory CASCADE;
DROP TABLE IF EXISTS semo.interaction_logs CASCADE;
DROP SCHEMA IF EXISTS semo CASCADE;
```

---

## Phase 2: 벡터 임베딩 파이프라인

### 목표

- OpenAI Embedding API 연동
- 비동기 임베딩 생성 파이프라인
- HNSW 벡터 인덱스 구성

### 작업 항목

#### 2.1 임베딩 생성 함수

```sql
-- pg_net을 활용한 비동기 임베딩 요청
CREATE OR REPLACE FUNCTION semo.request_embedding(
    p_text TEXT,
    p_memory_id BIGINT
) RETURNS BIGINT AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    SELECT net.http_post(
        url := 'https://api.openai.com/v1/embeddings',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.openai_api_key')
        ),
        body := jsonb_build_object(
            'model', 'text-embedding-3-small',
            'input', p_text
        )
    ) INTO v_request_id;

    -- 콜백 메타데이터 저장
    INSERT INTO semo.embedding_requests (request_id, memory_id, status)
    VALUES (v_request_id, p_memory_id, 'pending');

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;
```

#### 2.2 임베딩 요청 추적 테이블

```sql
CREATE TABLE semo.embedding_requests (
    request_id BIGINT PRIMARY KEY,
    memory_id BIGINT REFERENCES semo.semantic_memory(memory_id),
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

#### 2.3 임베딩 결과 처리 함수

```sql
CREATE OR REPLACE FUNCTION semo.process_embedding_response()
RETURNS void AS $$
DECLARE
    rec RECORD;
    v_response JSONB;
    v_embedding vector(1536);
BEGIN
    FOR rec IN
        SELECT er.request_id, er.memory_id
        FROM semo.embedding_requests er
        WHERE er.status = 'pending'
    LOOP
        -- pg_net 응답 확인
        SELECT response::jsonb INTO v_response
        FROM net._http_response
        WHERE id = rec.request_id;

        IF v_response IS NOT NULL THEN
            v_embedding := (v_response->'data'->0->>'embedding')::vector;

            UPDATE semo.semantic_memory
            SET embedding = v_embedding
            WHERE memory_id = rec.memory_id;

            UPDATE semo.embedding_requests
            SET status = 'completed', completed_at = NOW()
            WHERE request_id = rec.request_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### 2.4 HNSW 벡터 인덱스

```sql
-- 벡터 검색을 위한 HNSW 인덱스
CREATE INDEX idx_semantic_memory_embedding ON semo.semantic_memory
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### 2.5 임베딩 처리 스케줄러 (임시)

```sql
-- 1분마다 임베딩 응답 처리
SELECT cron.schedule(
    'process-embeddings',
    '* * * * *',
    $$SELECT semo.process_embedding_response()$$
);
```

### 검증 체크리스트

- [ ] OpenAI API 키 설정 확인
- [ ] 임베딩 요청 함수 테스트
- [ ] 임베딩 결과 저장 확인
- [ ] HNSW 인덱스 생성 확인
- [ ] 벡터 유사도 검색 테스트

### 롤백 계획

```sql
-- Phase 2 롤백
SELECT cron.unschedule('process-embeddings');
DROP INDEX IF EXISTS semo.idx_semantic_memory_embedding;
DROP TABLE IF EXISTS semo.embedding_requests;
DROP FUNCTION IF EXISTS semo.process_embedding_response();
DROP FUNCTION IF EXISTS semo.request_embedding(TEXT, BIGINT);
```

---

## Phase 3: 기억 통합 (Memory Consolidation)

### 목표

- 야간 배치 기억 통합
- 에피소딕 → 시맨틱 메모리 승격
- 메모리 디케이 알고리즘 적용

### 작업 항목

#### 3.1 기억 통합 함수

```sql
CREATE OR REPLACE FUNCTION semo.consolidate_memories()
RETURNS void AS $$
DECLARE
    v_user RECORD;
    v_summary TEXT;
    v_new_memory_id BIGINT;
BEGIN
    -- 사용자별 최근 24시간 로그 처리
    FOR v_user IN
        SELECT DISTINCT user_id
        FROM semo.interaction_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
    LOOP
        -- 중요 상호작용 추출 (스킬 사용, 긴 응답 등)
        WITH important_logs AS (
            SELECT log_id, content, skill_name
            FROM semo.interaction_logs
            WHERE user_id = v_user.user_id
              AND created_at > NOW() - INTERVAL '24 hours'
              AND (skill_name IS NOT NULL OR LENGTH(content) > 500)
            ORDER BY created_at
            LIMIT 20
        )
        SELECT string_agg(content, E'\n---\n') INTO v_summary
        FROM important_logs;

        IF v_summary IS NOT NULL THEN
            -- 시맨틱 메모리로 저장
            INSERT INTO semo.semantic_memory (
                user_id, memory_text, memory_type, importance_score
            ) VALUES (
                v_user.user_id, v_summary, 'episodic', 0.8
            ) RETURNING memory_id INTO v_new_memory_id;

            -- 임베딩 요청
            PERFORM semo.request_embedding(v_summary, v_new_memory_id);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2 메모리 디케이 함수

```sql
CREATE OR REPLACE FUNCTION semo.apply_memory_decay()
RETURNS void AS $$
BEGIN
    -- 지수 감쇠: importance = importance * e^(-λ * days_since_access)
    UPDATE semo.semantic_memory
    SET importance_score = importance_score * EXP(
        -0.05 * EXTRACT(DAY FROM (NOW() - last_accessed_at))
    )
    WHERE importance_score > 0.1;

    -- 중요도 0.1 미만 메모리 아카이브
    INSERT INTO semo.archived_memories
    SELECT * FROM semo.semantic_memory
    WHERE importance_score < 0.1;

    DELETE FROM semo.semantic_memory
    WHERE importance_score < 0.1;
END;
$$ LANGUAGE plpgsql;
```

#### 3.3 아카이브 테이블

```sql
CREATE TABLE semo.archived_memories (
    LIKE semo.semantic_memory INCLUDING ALL,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- 아카이브는 별도 저장소로 이동 가능
```

#### 3.4 야간 스케줄러

```sql
-- 매일 새벽 3시 기억 통합
SELECT cron.schedule(
    'consolidate-memories',
    '0 3 * * *',
    $$SELECT semo.consolidate_memories()$$
);

-- 매일 새벽 4시 메모리 디케이
SELECT cron.schedule(
    'apply-memory-decay',
    '0 4 * * *',
    $$SELECT semo.apply_memory_decay()$$
);
```

#### 3.5 사용자 팩트 추출 (Optional)

```sql
CREATE OR REPLACE FUNCTION semo.extract_user_facts(
    p_user_id UUID,
    p_log_id BIGINT,
    p_content TEXT
) RETURNS void AS $$
DECLARE
    v_facts JSONB;
BEGIN
    -- LLM 호출로 팩트 추출 (pg_net 사용)
    -- 예: "사용자가 Next.js 프로젝트에서 작업 중" → { category: 'tech_stack', key: 'framework', value: 'Next.js' }

    -- 추출된 팩트 저장 (UPSERT)
    INSERT INTO semo.user_facts (user_id, category, key, value, derived_from_log_id)
    VALUES (p_user_id, 'extracted', 'sample_key', 'sample_value', p_log_id)
    ON CONFLICT (user_id, category, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

### 검증 체크리스트

- [ ] 기억 통합 함수 수동 실행 테스트
- [ ] 디케이 알고리즘 시뮬레이션
- [ ] 아카이브 테이블 데이터 이동 확인
- [ ] pg_cron 스케줄 등록 확인
- [ ] 야간 배치 로그 모니터링

### 롤백 계획

```sql
-- Phase 3 롤백
SELECT cron.unschedule('consolidate-memories');
SELECT cron.unschedule('apply-memory-decay');
DROP TABLE IF EXISTS semo.archived_memories;
DROP FUNCTION IF EXISTS semo.extract_user_facts(UUID, BIGINT, TEXT);
DROP FUNCTION IF EXISTS semo.apply_memory_decay();
DROP FUNCTION IF EXISTS semo.consolidate_memories();
```

---

## Phase 4: 하이브리드 검색

### 목표

- 벡터 + 키워드 하이브리드 검색
- RRF (Reciprocal Rank Fusion) 알고리즘
- 컨텍스트 인식 검색

### 작업 항목

#### 4.1 전문 검색 인덱스

```sql
-- GIN 인덱스 (Full-text search)
CREATE INDEX idx_semantic_memory_fts ON semo.semantic_memory
USING gin (to_tsvector('english', memory_text));

-- Trigram 인덱스 (Fuzzy matching)
CREATE INDEX idx_semantic_memory_trgm ON semo.semantic_memory
USING gin (memory_text gin_trgm_ops);
```

#### 4.2 하이브리드 검색 함수

```sql
CREATE OR REPLACE FUNCTION semo.hybrid_search(
    p_user_id UUID,
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INT DEFAULT 10,
    p_vector_weight FLOAT DEFAULT 0.7,
    p_keyword_weight FLOAT DEFAULT 0.3
) RETURNS TABLE (
    memory_id BIGINT,
    memory_text TEXT,
    memory_type VARCHAR(50),
    combined_score FLOAT,
    vector_rank INT,
    keyword_rank INT
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            sm.memory_id,
            sm.memory_text,
            sm.memory_type,
            1 - (sm.embedding <=> p_query_embedding) AS similarity,
            ROW_NUMBER() OVER (ORDER BY sm.embedding <=> p_query_embedding) AS rank
        FROM semo.semantic_memory sm
        WHERE sm.user_id = p_user_id
          AND sm.embedding IS NOT NULL
        ORDER BY sm.embedding <=> p_query_embedding
        LIMIT p_limit * 2
    ),
    keyword_search AS (
        SELECT
            sm.memory_id,
            sm.memory_text,
            sm.memory_type,
            ts_rank(to_tsvector('english', sm.memory_text), plainto_tsquery('english', p_query)) AS rank_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', sm.memory_text), plainto_tsquery('english', p_query)) DESC) AS rank
        FROM semo.semantic_memory sm
        WHERE sm.user_id = p_user_id
          AND to_tsvector('english', sm.memory_text) @@ plainto_tsquery('english', p_query)
        LIMIT p_limit * 2
    ),
    rrf_combined AS (
        SELECT
            COALESCE(v.memory_id, k.memory_id) AS memory_id,
            COALESCE(v.memory_text, k.memory_text) AS memory_text,
            COALESCE(v.memory_type, k.memory_type) AS memory_type,
            -- RRF Score: 1/(k+rank)
            COALESCE(p_vector_weight * (1.0 / (60 + v.rank)), 0) +
            COALESCE(p_keyword_weight * (1.0 / (60 + k.rank)), 0) AS combined_score,
            v.rank AS vector_rank,
            k.rank AS keyword_rank
        FROM vector_search v
        FULL OUTER JOIN keyword_search k ON v.memory_id = k.memory_id
    )
    SELECT
        rrf.memory_id,
        rrf.memory_text,
        rrf.memory_type,
        rrf.combined_score,
        rrf.vector_rank::INT,
        rrf.keyword_rank::INT
    FROM rrf_combined rrf
    ORDER BY rrf.combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

#### 4.3 컨텍스트 인식 검색

```sql
CREATE OR REPLACE FUNCTION semo.contextual_search(
    p_user_id UUID,
    p_query TEXT,
    p_query_embedding vector(1536),
    p_current_skill VARCHAR(255) DEFAULT NULL,
    p_limit INT DEFAULT 5
) RETURNS TABLE (
    memory_id BIGINT,
    memory_text TEXT,
    relevance_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH base_search AS (
        SELECT * FROM semo.hybrid_search(p_user_id, p_query, p_query_embedding, p_limit * 2)
    ),
    skill_boost AS (
        SELECT
            bs.memory_id,
            bs.memory_text,
            bs.combined_score *
            CASE
                WHEN p_current_skill IS NOT NULL AND bs.memory_text ILIKE '%' || p_current_skill || '%'
                THEN 1.2  -- 현재 스킬 관련 메모리 부스트
                ELSE 1.0
            END AS boosted_score
        FROM base_search bs
    ),
    recency_factor AS (
        SELECT
            sb.memory_id,
            sb.memory_text,
            sb.boosted_score * (
                1.0 + 0.1 * GREATEST(0, 7 - EXTRACT(DAY FROM (NOW() - sm.last_accessed_at)))
            ) AS final_score
        FROM skill_boost sb
        JOIN semo.semantic_memory sm ON sb.memory_id = sm.memory_id
    )
    SELECT
        rf.memory_id,
        rf.memory_text,
        rf.final_score AS relevance_score
    FROM recency_factor rf
    ORDER BY rf.final_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

#### 4.4 접근 기록 업데이트 트리거

```sql
CREATE OR REPLACE FUNCTION semo.update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE semo.semantic_memory
    SET
        access_count = access_count + 1,
        last_accessed_at = NOW(),
        importance_score = LEAST(importance_score * 1.05, 2.0)  -- 접근 시 중요도 증가 (상한 2.0)
    WHERE memory_id = NEW.memory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 검증 체크리스트

- [ ] FTS 인덱스 생성 확인
- [ ] 하이브리드 검색 함수 테스트
- [ ] RRF 점수 계산 검증
- [ ] 컨텍스트 부스팅 동작 확인
- [ ] 검색 성능 벤치마크 (< 100ms)

### 롤백 계획

```sql
-- Phase 4 롤백
DROP FUNCTION IF EXISTS semo.update_memory_access();
DROP FUNCTION IF EXISTS semo.contextual_search(UUID, TEXT, vector, VARCHAR, INT);
DROP FUNCTION IF EXISTS semo.hybrid_search(UUID, TEXT, vector, INT, FLOAT, FLOAT);
DROP INDEX IF EXISTS semo.idx_semantic_memory_trgm;
DROP INDEX IF EXISTS semo.idx_semantic_memory_fts;
```

---

## Phase 5: 보안 강화

### 목표

- Row Level Security (RLS) 적용
- PII 마스킹
- 감사 로그

### 작업 항목

#### 5.1 Row Level Security

```sql
-- RLS 활성화
ALTER TABLE semo.interaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semo.semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE semo.user_facts ENABLE ROW LEVEL SECURITY;

-- 사용자별 접근 정책
CREATE POLICY user_isolation_logs ON semo.interaction_logs
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_isolation_memory ON semo.semantic_memory
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_isolation_facts ON semo.user_facts
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);
```

#### 5.2 PII 마스킹 함수

```sql
CREATE OR REPLACE FUNCTION semo.mask_pii(p_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    p_text,
                    '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  -- 이메일
                    '[EMAIL_MASKED]', 'g'
                ),
                '\b\d{3}[-.]?\d{3,4}[-.]?\d{4}\b',  -- 전화번호
                '[PHONE_MASKED]', 'g'
            ),
            '\b\d{6}[-]?\d{7}\b',  -- 주민번호
            '[SSN_MASKED]', 'g'
        ),
        '\b(?:\d{4}[-\s]?){3}\d{4}\b',  -- 카드번호
        '[CARD_MASKED]', 'g'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 5.3 자동 PII 마스킹 트리거

```sql
CREATE OR REPLACE FUNCTION semo.auto_mask_pii()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content := semo.mask_pii(NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mask_pii_logs
    BEFORE INSERT ON semo.interaction_logs
    FOR EACH ROW EXECUTE FUNCTION semo.auto_mask_pii();
```

#### 5.4 감사 로그

```sql
CREATE TABLE semo.audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    operation VARCHAR(10),
    user_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION semo.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO semo.audit_logs (table_name, operation, user_id, old_data, new_data)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            '00000000-0000-0000-0000-000000000000'::UUID
        ),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 감사 트리거 적용
CREATE TRIGGER audit_semantic_memory
    AFTER INSERT OR UPDATE OR DELETE ON semo.semantic_memory
    FOR EACH ROW EXECUTE FUNCTION semo.audit_trigger();
```

#### 5.5 데이터 보존 정책

```sql
-- 90일 이상 로그 자동 삭제
SELECT cron.schedule(
    'cleanup-old-logs',
    '0 5 * * 0',  -- 매주 일요일 새벽 5시
    $$DELETE FROM semo.interaction_logs WHERE created_at < NOW() - INTERVAL '90 days'$$
);

-- 180일 이상 아카이브 삭제
SELECT cron.schedule(
    'cleanup-archived-memories',
    '0 5 1 * *',  -- 매월 1일 새벽 5시
    $$DELETE FROM semo.archived_memories WHERE archived_at < NOW() - INTERVAL '180 days'$$
);
```

### 검증 체크리스트

- [ ] RLS 정책 테스트 (다른 사용자 데이터 접근 불가)
- [ ] PII 마스킹 패턴 검증
- [ ] 감사 로그 기록 확인
- [ ] 데이터 보존 정책 스케줄 확인

### 롤백 계획

```sql
-- Phase 5 롤백
SELECT cron.unschedule('cleanup-old-logs');
SELECT cron.unschedule('cleanup-archived-memories');
DROP TRIGGER IF EXISTS audit_semantic_memory ON semo.semantic_memory;
DROP TRIGGER IF EXISTS trg_mask_pii_logs ON semo.interaction_logs;
DROP FUNCTION IF EXISTS semo.audit_trigger();
DROP FUNCTION IF EXISTS semo.auto_mask_pii();
DROP FUNCTION IF EXISTS semo.mask_pii(TEXT);
DROP TABLE IF EXISTS semo.audit_logs;
DROP POLICY IF EXISTS user_isolation_facts ON semo.user_facts;
DROP POLICY IF EXISTS user_isolation_memory ON semo.semantic_memory;
DROP POLICY IF EXISTS user_isolation_logs ON semo.interaction_logs;
ALTER TABLE semo.user_facts DISABLE ROW LEVEL SECURITY;
ALTER TABLE semo.semantic_memory DISABLE ROW LEVEL SECURITY;
ALTER TABLE semo.interaction_logs DISABLE ROW LEVEL SECURITY;
```

---

## Phase 6: 모니터링 및 최적화

### 목표

- 성능 메트릭 수집
- 대시보드 구축
- 쿼리 최적화

### 작업 항목

#### 6.1 통계 테이블

```sql
CREATE TABLE semo.memory_stats (
    stat_id BIGSERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,
    total_interactions BIGINT,
    total_memories BIGINT,
    avg_embedding_latency_ms FLOAT,
    avg_search_latency_ms FLOAT,
    active_users INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 일일 통계 수집
CREATE OR REPLACE FUNCTION semo.collect_daily_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO semo.memory_stats (
        stat_date,
        total_interactions,
        total_memories,
        active_users
    )
    SELECT
        CURRENT_DATE,
        COUNT(*) FILTER (WHERE il.created_at::DATE = CURRENT_DATE),
        (SELECT COUNT(*) FROM semo.semantic_memory),
        COUNT(DISTINCT il.user_id) FILTER (WHERE il.created_at::DATE = CURRENT_DATE)
    FROM semo.interaction_logs il;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
    'collect-daily-stats',
    '0 23 * * *',
    $$SELECT semo.collect_daily_stats()$$
);
```

#### 6.2 쿼리 성능 모니터링

```sql
-- 느린 쿼리 로깅
CREATE TABLE semo.slow_queries (
    query_id BIGSERIAL PRIMARY KEY,
    query_text TEXT,
    execution_time_ms FLOAT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 실행 시간 측정 래퍼
CREATE OR REPLACE FUNCTION semo.timed_search(
    p_user_id UUID,
    p_query TEXT,
    p_query_embedding vector(1536)
) RETURNS TABLE (
    memory_id BIGINT,
    memory_text TEXT,
    relevance_score FLOAT,
    execution_time_ms FLOAT
) AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    v_start := clock_timestamp();

    RETURN QUERY
    SELECT
        cs.memory_id,
        cs.memory_text,
        cs.relevance_score,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::FLOAT
    FROM semo.contextual_search(p_user_id, p_query, p_query_embedding) cs;

    v_end := clock_timestamp();

    -- 100ms 초과 시 로깅
    IF EXTRACT(MILLISECONDS FROM (v_end - v_start)) > 100 THEN
        INSERT INTO semo.slow_queries (query_text, execution_time_ms, user_id)
        VALUES (p_query, EXTRACT(MILLISECONDS FROM (v_end - v_start)), p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
```

#### 6.3 인덱스 최적화

```sql
-- 인덱스 사용률 확인
CREATE VIEW semo.index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'semo'
ORDER BY idx_scan DESC;

-- 미사용 인덱스 알림
CREATE OR REPLACE FUNCTION semo.alert_unused_indexes()
RETURNS TABLE (index_name TEXT, last_used TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT indexname::TEXT, NULL::TIMESTAMPTZ
    FROM pg_stat_user_indexes
    WHERE schemaname = 'semo'
      AND idx_scan = 0
      AND pg_relation_size(indexrelid) > 1024 * 1024;  -- 1MB 이상
END;
$$ LANGUAGE plpgsql;
```

#### 6.4 테이블 파티셔닝 (대용량 대비)

```sql
-- interaction_logs 월별 파티셔닝
CREATE TABLE semo.interaction_logs_partitioned (
    LIKE semo.interaction_logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- 월별 파티션 자동 생성
CREATE OR REPLACE FUNCTION semo.create_monthly_partition()
RETURNS void AS $$
DECLARE
    v_start DATE;
    v_end DATE;
    v_partition_name TEXT;
BEGIN
    v_start := date_trunc('month', NOW() + INTERVAL '1 month');
    v_end := v_start + INTERVAL '1 month';
    v_partition_name := 'interaction_logs_' || to_char(v_start, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS semo.%I PARTITION OF semo.interaction_logs_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        v_partition_name, v_start, v_end
    );
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
    'create-monthly-partition',
    '0 0 25 * *',  -- 매월 25일
    $$SELECT semo.create_monthly_partition()$$
);
```

### 검증 체크리스트

- [ ] 일일 통계 수집 동작 확인
- [ ] 느린 쿼리 로깅 테스트
- [ ] 인덱스 사용률 조회 확인
- [ ] 파티션 자동 생성 테스트

---

## 체크포인트 및 마일스톤

### Phase 완료 기준

| Phase | 완료 기준 | 검증 방법 |
|-------|----------|----------|
| 1 | 스키마 생성, 기본 로깅 | 로그 삽입/조회 테스트 |
| 2 | 임베딩 파이프라인 | 벡터 검색 < 50ms |
| 3 | 야간 배치 안정화 | 1주일 무장애 운영 |
| 4 | 하이브리드 검색 | 검색 정확도 > 80% |
| 5 | 보안 테스트 통과 | 침투 테스트 완료 |
| 6 | 성능 SLA 달성 | P95 < 100ms |

### Go/No-Go 결정 포인트

각 Phase 완료 후:

1. **기술 리뷰**: 코드 리뷰 + 아키텍처 검토
2. **성능 테스트**: 부하 테스트 수행
3. **보안 검토**: Phase 5 완료 후 필수
4. **운영 준비도**: 모니터링/알림 설정 확인

### 롤백 트리거

- P1 장애 발생 시 즉시 이전 Phase로 롤백
- 성능 SLA 미달 시 최적화 후 재시도
- 데이터 정합성 이슈 시 롤백 + 데이터 복구

---

## 참조

- [PostgreSQL 기반 장기 기억 아키텍처 보고서](./POSTGRESQL_BASED_LONG_TERM_MEMORY_REPORT.md)
- [SEMO 아키텍처 개요](./ARCHITECTURE.md)
- [pgvector 공식 문서](https://github.com/pgvector/pgvector)
- [pg_cron 공식 문서](https://github.com/citusdata/pg_cron)
