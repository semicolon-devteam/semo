-- 017_ontology_instance_model.sql
-- 온톨로지 인스턴스 모델: 서비스 인스턴스 중심 재구성 + entity_type FK
-- Discussion #235 (2026-03-22) 합의 기반
--
-- 핵심 변경:
--   1. ontology.entity_type → FK 참조 ontology_types.type_key
--   2. 서비스 인스턴스를 ontology 1등 시민으로 등록
--   3. 글로벌 도메인에 service='_global' 태깅
--   4. KB 엔트리 도메인을 서비스 인스턴스 스코프(dot-notation)로 전환

BEGIN;

-- ============================================================
-- 1. entity_type backfill (NULL → 적절한 타입 매핑)
-- ============================================================

-- 서비스 스코프 도메인 (my-service.kpi → kpi)
UPDATE semo.ontology
SET entity_type = split_part(domain, '.', 2)
WHERE entity_type IS NULL AND domain LIKE '%.%'
  AND split_part(domain, '.', 2) IN (
    SELECT type_key FROM semo.ontology_types
  );

-- 서비스 프로필 도메인 (my-service → service)
-- NOTE: organization 도메인은 INSERT 시 entity_type='organization' 이 설정되므로
-- entity_type IS NULL 필터에 걸리지 않아 별도 제외 목록이 불필요하다.
UPDATE semo.ontology
SET entity_type = 'service'
WHERE entity_type IS NULL
  AND domain NOT LIKE '%.%'
  AND domain NOT IN (
    'team','project','decision','process','infra','kpi',
    'bot-config','spec','skill','milestone','memory','glossary',
    'session-log'
  );

-- 나머지 NULL → glossary (안전망)
UPDATE semo.ontology
SET entity_type = 'glossary'
WHERE entity_type IS NULL;

-- ============================================================
-- 2. entity_type FK 제약 추가
-- ============================================================

-- 누락된 entity_type 값이 ontology_types에 없으면 등록
INSERT INTO semo.ontology_types (type_key, schema, description)
SELECT DISTINCT o.entity_type, '{}'::jsonb, o.entity_type || ' (auto-registered)'
FROM semo.ontology o
WHERE NOT EXISTS (
  SELECT 1 FROM semo.ontology_types t WHERE t.type_key = o.entity_type
)
ON CONFLICT (type_key) DO NOTHING;

ALTER TABLE semo.ontology
  ALTER COLUMN entity_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ontology_entity_type'
      AND table_schema = 'semo'
  ) THEN
    ALTER TABLE semo.ontology
      ADD CONSTRAINT fk_ontology_entity_type
        FOREIGN KEY (entity_type) REFERENCES semo.ontology_types(type_key);
  END IF;
END $$;

-- ============================================================
-- 3. 서비스 인스턴스 등록 (1등 시민)
-- ============================================================

-- organization 타입 등록 (팀/조직)
INSERT INTO semo.ontology_types (type_key, schema, description) VALUES
  ('organization', '{}'::jsonb, '팀/조직 (서비스 상위 개체)'),
  ('session-log',  '{}'::jsonb, '세션 로그')
ON CONFLICT (type_key) DO NOTHING;

-- NOTE: 신규 OSS 인스턴스는 organization/service ontology row 를
-- `semo kb ontology --action register` 로 직접 등록한다.
-- 과거 세미콜론 인스턴스에 시드되었던 행(`semicolon` org, `jungchipan`/`playland` service)은
-- migration 108 에서 KB 데이터 0건일 때만 조건부 삭제된다.

-- ============================================================
-- 4. 글로벌 도메인에 service='_global' 태깅
-- ============================================================

UPDATE semo.ontology
SET service = '_global'
WHERE service IS NULL
  AND entity_type NOT IN ('service', 'organization');

-- ============================================================
-- 5. KB 엔트리 도메인 전환 (flat → service-scoped dot-notation)
--    team → _global.team, project → _global.project 등
--    단, 이미 dot-notation인 도메인(my-service.kpi)은 유지
-- ============================================================

-- 먼저 대상 도메인을 온톨로지에 등록 (dot-notation)
-- 단, service/organization 인스턴스는 제외 (my-org, my-service 등은 top-level 유지)
INSERT INTO semo.ontology (domain, entity_type, service, schema, description)
SELECT '_global.' || o.domain, o.entity_type, '_global', o.schema, o.description
FROM semo.ontology o
WHERE o.service = '_global'
  AND o.domain NOT LIKE '%.%'
  AND o.entity_type NOT IN ('service', 'organization')
  AND NOT EXISTS (
    SELECT 1 FROM semo.ontology WHERE domain = '_global.' || o.domain
  )
ON CONFLICT (domain) DO NOTHING;

-- KB 엔트리 도메인 키 전환
-- 단, service/organization 인스턴스 도메인은 제외
UPDATE semo.knowledge_base
SET domain = '_global.' || domain
WHERE domain NOT LIKE '%.%'
  AND domain IN (
    SELECT domain FROM semo.ontology
    WHERE service = '_global'
      AND domain NOT LIKE '%.%'
      AND entity_type NOT IN ('service', 'organization')
  );

-- 기존 flat 도메인 온톨로지 엔트리 제거 (dot-notation으로 이전됨)
-- 단, service/organization 인스턴스는 유지
DELETE FROM semo.ontology
WHERE service = '_global'
  AND domain NOT LIKE '%.%'
  AND entity_type NOT IN ('service', 'organization')
  AND EXISTS (
    SELECT 1 FROM semo.ontology o2 WHERE o2.domain = '_global.' || semo.ontology.domain
  );

-- ============================================================
-- 6. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ontology_entity_type_fk
  ON semo.ontology (entity_type);

-- ============================================================
-- 7. knowledge_base service generated column 갱신
--    기존: service = split_part(domain, '.', 1) WHERE domain LIKE '%.%'
--    변경 없음 — _global.team → service='_global', my-service.kpi → service='my-service'
--    generated column은 ALTER 불가이므로 그대로 유지
-- ============================================================

COMMIT;
