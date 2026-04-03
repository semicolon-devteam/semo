-- 045: GFP → Service 테이블 리네이밍 + Projection Key 시스템
--
-- 변경 사항:
--   A. gfp_* 테이블 → service_* 리네이밍
--   B. 제약조건 / 인덱스 / 트리거 리네이밍
--   C. 하위 호환 VIEW (gfp_* → service_*)
--   D. service_domain → ontology.domain FK 연계 (기존 데이터 정합성 보장)
--   E. kb_type_schema에 source 컬럼 + projection 키 등록
--   F. lifecycle / launched_at 컬럼 추가
--
-- PK 컬럼명 gfp_id는 이 마이그레이션에서 유지 (코드 변경 최소화).
-- 후속 마이그레이션에서 project_id로 rename 가능.
--
-- 선행 조건: 044_gfp_stitch_screenshots.sql 적용 완료

BEGIN;

-- ============================================================
-- A. 테이블 리네이밍
-- ============================================================

ALTER TABLE semo.gfp_projects        RENAME TO service_projects;
ALTER TABLE semo.gfp_phase_sections  RENAME TO service_sections;
ALTER TABLE semo.gfp_materials       RENAME TO service_materials;
ALTER TABLE semo.gfp_research_tasks  RENAME TO service_research_tasks;
ALTER TABLE semo.gfp_infra_requests  RENAME TO service_infra_requests;

-- ============================================================
-- B. 제약조건 / 인덱스 / 트리거 리네이밍
-- ============================================================

-- B-1. UNIQUE 제약조건
ALTER TABLE semo.service_sections
  RENAME CONSTRAINT gfp_phase_sections_gfp_id_track_phase_section_key_key
  TO service_sections_gfp_id_track_phase_section_key_key;

-- B-2. FK 제약조건
ALTER TABLE semo.service_sections
  RENAME CONSTRAINT gfp_phase_sections_gfp_id_fkey
  TO service_sections_project_fkey;

ALTER TABLE semo.service_materials
  RENAME CONSTRAINT gfp_materials_gfp_id_fkey
  TO service_materials_project_fkey;

ALTER TABLE semo.service_research_tasks
  RENAME CONSTRAINT gfp_research_tasks_gfp_id_fkey
  TO service_research_tasks_project_fkey;

ALTER TABLE semo.service_infra_requests
  RENAME CONSTRAINT gfp_infra_requests_gfp_id_fkey
  TO service_infra_requests_project_fkey;

ALTER TABLE semo.service_infra_requests
  RENAME CONSTRAINT gfp_infra_requests_source_section_id_fkey
  TO service_infra_requests_section_fkey;

-- B-3. 인덱스
ALTER INDEX semo.idx_gfp_sections_project
  RENAME TO idx_service_sections_project;

ALTER INDEX semo.idx_gfp_infra_requests_project
  RENAME TO idx_service_infra_requests_project;

-- B-4. 트리거
ALTER TRIGGER trg_gfp_projects_updated ON semo.service_projects
  RENAME TO trg_service_projects_updated;

ALTER TRIGGER trg_gfp_sections_updated ON semo.service_sections
  RENAME TO trg_service_sections_updated;

ALTER TRIGGER trg_gfp_research_updated ON semo.service_research_tasks
  RENAME TO trg_service_research_tasks_updated;

-- B-5. 트리거 함수 리네이밍
ALTER FUNCTION semo.gfp_set_updated_at() RENAME TO service_set_updated_at;

-- ============================================================
-- C. 하위 호환 VIEW (전환 기간 2주 후 제거 예정)
-- ============================================================

CREATE VIEW semo.gfp_projects        AS SELECT * FROM semo.service_projects;
CREATE VIEW semo.gfp_phase_sections  AS SELECT * FROM semo.service_sections;
CREATE VIEW semo.gfp_materials       AS SELECT * FROM semo.service_materials;
CREATE VIEW semo.gfp_research_tasks  AS SELECT * FROM semo.service_research_tasks;
CREATE VIEW semo.gfp_infra_requests  AS SELECT * FROM semo.service_infra_requests;

-- ============================================================
-- D. service_domain → ontology FK 연계
-- ============================================================

-- D-1. 기존 데이터 정합성 보장:
--       service_domain이 NOT NULL인데 ontology에 없는 경우 자동 등록
INSERT INTO semo.ontology (domain, entity_type, service, schema, description, tags)
SELECT DISTINCT
  sp.service_domain,
  'service',
  sp.service_domain,
  '{}'::jsonb,
  sp.project_name || ' (auto-registered by migration 045)',
  ARRAY['gfp-migrated']
FROM semo.service_projects sp
WHERE sp.service_domain IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM semo.ontology o WHERE o.domain = sp.service_domain
  );

-- D-2. FK 추가 (NULL 허용 — service_domain이 nullable)
ALTER TABLE semo.service_projects
  ADD CONSTRAINT service_projects_ontology_domain_fkey
  FOREIGN KEY (service_domain) REFERENCES semo.ontology(domain);

-- ============================================================
-- E. kb_type_schema — source 컬럼 + projection 키 등록
-- ============================================================

-- E-1. source 컬럼 추가
ALTER TABLE semo.kb_type_schema
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

-- E-2. service 타입에 projection 키 등록
INSERT INTO semo.kb_type_schema
  (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type, source)
VALUES
  ('service', 'spec',         'PM 파이프라인 스펙 산출물 (자동 동기화)',           false, 'spec/discovery, spec/prd, spec/design-system', 20, 'collection', 'projection'),
  ('service', 'pm-status',    '프로젝트 진행 상태 (자동 동기화)',                  false, NULL,                                           21, 'singleton',  'projection'),
  ('service', 'infra-status', '인프라 트랙 진행 상태 (자동 동기화)',               false, NULL,                                           22, 'singleton',  'projection'),
  ('service', 'pm-summary',   '프로젝트 라이프사이클 요약 (자동 동기화)',           false, NULL,                                           23, 'singleton',  'projection'),
  ('service', 'gfp-id',       '(레거시) 프로젝트 ID 참조 — pm-status로 통합 예정', false, NULL,                                           24, 'singleton',  'projection'),
  ('service', 'gfp-status',   '(레거시) 진행 상태 — pm-status로 통합 예정',       false, NULL,                                           25, 'singleton',  'projection')
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  source = EXCLUDED.source,
  key_type = EXCLUDED.key_type,
  scheme_description = EXCLUDED.scheme_description,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- F. lifecycle / launched_at 컬럼
-- ============================================================

ALTER TABLE semo.service_projects
  ADD COLUMN IF NOT EXISTS lifecycle   VARCHAR(20) NOT NULL DEFAULT 'build',
  ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ;

-- 완료된 프로젝트는 lifecycle = 'ops'로 마이그레이션
UPDATE semo.service_projects
SET lifecycle = 'ops', launched_at = updated_at
WHERE status = 'completed';

COMMIT;
