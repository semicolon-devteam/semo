-- Migration 015: KB Domain Enforcement + KPI/Decision Ontology Update
--
-- 1. 고아 도메인 자동 등록 (FK 추가 전 안전장치)
-- 2. FK 제약 추가 (domain → ontology)
-- 3. KPI/Decision 온톨로지 스키마 업데이트
-- 4. 임베딩 NULL 인덱스

BEGIN;

-- ============================================================
-- 1. 고아 도메인 자동 등록
-- ============================================================
INSERT INTO semo.ontology (domain, schema, description, version)
SELECT DISTINCT kb.domain,
       '{"type":"object","properties":{"content":{"type":"string"}}}'::jsonb,
       'Auto-created during FK migration', 1
FROM semo.knowledge_base kb
WHERE NOT EXISTS (SELECT 1 FROM semo.ontology o WHERE o.domain = kb.domain)
ON CONFLICT (domain) DO NOTHING;

-- ============================================================
-- 2. FK 추가 (ON UPDATE CASCADE, ON DELETE RESTRICT)
-- ============================================================
ALTER TABLE semo.knowledge_base
  ADD CONSTRAINT fk_kb_domain_ontology
  FOREIGN KEY (domain) REFERENCES semo.ontology(domain)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ============================================================
-- 3. KPI 온톨로지 스키마 업데이트
-- ============================================================
UPDATE semo.ontology SET schema = '{
  "type": "object",
  "required": ["content"],
  "properties": {
    "content": {"type": "string"},
    "metadata": {
      "type": "object",
      "properties": {
        "project": {"type": "string", "description": "프로젝트 ID (예: gameland, jungchipan)"},
        "record_type": {"type": "string", "enum": ["current", "weekly", "target"], "description": "current=최신 스냅샷, weekly=주간 기록, target=목표"},
        "week": {"type": "string", "description": "YYYY-WNN 형식 (weekly 타입만)"},
        "measured_at": {"type": "string", "description": "측정일 ISO 8601"}
      },
      "required": ["project", "record_type"]
    }
  }
}'::jsonb,
description = 'KPI 지표. key 형식: {project}/current | {project}/target | {project}/YYYY-WNN',
version = version + 1
WHERE domain = 'kpi';

-- ============================================================
-- 4. Decision 온톨로지 스키마 업데이트
-- ============================================================
UPDATE semo.ontology SET schema = '{
  "type": "object",
  "required": ["content"],
  "properties": {
    "content": {"type": "string"},
    "metadata": {
      "type": "object",
      "properties": {
        "date": {"type": "string", "description": "결정일 YYYY-MM-DD"},
        "participants": {"type": "array", "items": {"type": "string"}, "description": "참여자 목록"},
        "status": {"type": "string", "enum": ["active", "superseded", "revoked"], "description": "결정 상태"},
        "source_meeting": {"type": "string", "description": "관련 회의 링크"}
      },
      "required": ["date"]
    }
  }
}'::jsonb,
description = '의사결정 기록 (ADR). key: {YYYY-MM-DD}/{slug}. 하나의 엔트리에 전체 결정 포함.',
version = version + 1
WHERE domain = 'decision';

-- ============================================================
-- 5. 임베딩 NULL 인덱스 (backfill 쿼리 최적화)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kb_embedding_null
  ON semo.knowledge_base(domain) WHERE embedding IS NULL;

COMMIT;
