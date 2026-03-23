-- 016_ontology_redesign.sql
-- 온톨로지 재설계: 서비스(프로젝트) 단위 + 타입 분리
-- Discussion #235 (2026-03-22) 합의 기반

BEGIN;

-- ============================================================
-- 1. ontology_types 테이블 (구조적 템플릿, 서비스와 독립)
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.ontology_types (
    id          BIGSERIAL PRIMARY KEY,
    type_key    VARCHAR(100) NOT NULL UNIQUE,
    schema      JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    version     INT DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 시드 타입 등록
INSERT INTO semo.ontology_types (type_key, schema, description) VALUES
('service',    '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"status":{"type":"string","enum":["active","archived","planned"]},"tech_stack":{"type":"array","items":{"type":"string"}}}}}}', '서비스(프로젝트) 프로필'),
('person',     '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"role":{"type":"string"},"squad":{"type":"string"}}}}}', '팀원 정보'),
('decision',   '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","required":["date","status"],"properties":{"date":{"type":"string","format":"date"},"status":{"type":"string","enum":["proposed","accepted","deprecated"]},"participants":{"type":"array","items":{"type":"string"}}}}}}', '의사결정 기록'),
('process',    '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"owner":{"type":"string"},"frequency":{"type":"string"}}}}}', '업무 프로세스'),
('kpi',        '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"project":{"type":"string"},"period":{"type":"string"},"value":{"type":"number"},"target":{"type":"number"}}}}}', 'KPI 지표'),
('milestone',  '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","required":["project","title","start_date","end_date","status"],"properties":{"project":{"type":"string"},"title":{"type":"string"},"start_date":{"type":"string","format":"date"},"end_date":{"type":"string","format":"date"},"status":{"type":"string","enum":["planned","in-progress","completed"]},"order":{"type":"integer"}}}}}', '마일스톤'),
('infra',      '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"provider":{"type":"string"},"region":{"type":"string"}}}}}', '인프라 구성'),
('spec',       '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"status":{"type":"string","enum":["draft","review","approved","archived"]},"author":{"type":"string"}}}}}', '스펙/설계 문서'),
('bot-config', '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"bot_id":{"type":"string"},"file_type":{"type":"string"}}}}}', '봇 설정/규격'),
('skill',      '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"bot_ids":{"type":"array","items":{"type":"string"}},"category":{"type":"string"}}}}}', '스킬 정의'),
('glossary',   '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","properties":{"aliases":{"type":"array","items":{"type":"string"}}}}}}', '용어 사전'),
('memory',     '{"type":"object","properties":{"content":{"type":"string"},"metadata":{"type":"object","required":["source_type","source_id","date"],"properties":{"source_type":{"type":"string","enum":["bot","local-session"]},"source_id":{"type":"string"},"date":{"type":"string","format":"date"},"content_hash":{"type":"string"},"original_size":{"type":"integer"},"synced_at":{"type":"string","format":"date-time"}}}}}', '봇/세션 일일 메모리 (L1→L2 싱크). key: {sourceId}/{YYYY-MM-DD}')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- 2. ontology 테이블 컬럼 확장
-- ============================================================

ALTER TABLE semo.ontology
  ADD COLUMN IF NOT EXISTS service     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parent      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tags        TEXT[] DEFAULT '{}';

-- ============================================================
-- 3. 기존 도메인 backfill (entity_type 매핑)
-- ============================================================

UPDATE semo.ontology SET entity_type = 'person'     WHERE domain = 'team'       AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'service'    WHERE domain = 'project'    AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'decision'   WHERE domain = 'decision'   AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'process'    WHERE domain = 'process'    AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'infra'      WHERE domain = 'infra'      AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'kpi'        WHERE domain = 'kpi'        AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'bot-config' WHERE domain = 'bot-config' AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'spec'       WHERE domain = 'spec'       AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'skill'      WHERE domain = 'skill'      AND entity_type IS NULL;
UPDATE semo.ontology SET entity_type = 'milestone'  WHERE domain = 'milestone'  AND entity_type IS NULL;

-- ============================================================
-- 4. memory 도메인 등록 (L1→L2 동기화용)
-- ============================================================

INSERT INTO semo.ontology (domain, entity_type, schema, description) VALUES
('memory', 'memory', '{
  "type": "object",
  "properties": {
    "content": {"type": "string"},
    "metadata": {
      "type": "object",
      "required": ["source_type", "source_id", "date"],
      "properties": {
        "source_type": {"enum": ["bot", "local-session"]},
        "source_id": {"type": "string"},
        "date": {"type": "string", "format": "date"},
        "content_hash": {"type": "string"},
        "original_size": {"type": "integer"},
        "synced_at": {"type": "string", "format": "date-time"}
      }
    }
  }
}', '봇/세션 일일 메모리 (L1→L2 싱크). key: {sourceId}/{YYYY-MM-DD}')
ON CONFLICT (domain) DO UPDATE SET
  entity_type = EXCLUDED.entity_type,
  schema = EXCLUDED.schema,
  description = EXCLUDED.description;

-- ============================================================
-- 5. knowledge_base — generated column for service extraction
-- ============================================================

ALTER TABLE semo.knowledge_base
  ADD COLUMN IF NOT EXISTS service VARCHAR(100)
    GENERATED ALWAYS AS (
      CASE WHEN domain LIKE '%.%' THEN split_part(domain, '.', 1) ELSE NULL END
    ) STORED;

-- ============================================================
-- 6. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ontology_service     ON semo.ontology (service) WHERE service IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ontology_entity_type ON semo.ontology (entity_type) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_service           ON semo.knowledge_base (service) WHERE service IS NOT NULL;

COMMIT;
