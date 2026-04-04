-- 052: service_projects → services 테이블 리네이밍 + PK gfp_id → service_id
--
-- 변경 사항:
--   A. service_projects → services 리네이밍
--   B. PK/FK 컬럼 gfp_id/project_id → service_id 통일
--   C. 제약조건 / 인덱스 리네이밍
--   D. 트리거 리네이밍
--   E. 하위 호환 VIEW 재생성 (gfp_id alias 포함)
--
-- 선행 조건: 051 이하 모든 마이그레이션 적용 완료

BEGIN;

-- ============================================================
-- A. 테이블 리네이밍
-- ============================================================

-- 기존 하위 호환 VIEW 제거 (테이블 리네임 시 CASCADE 방지)
DROP VIEW IF EXISTS semo.gfp_projects CASCADE;
DROP VIEW IF EXISTS semo.gfp_phase_sections CASCADE;
DROP VIEW IF EXISTS semo.gfp_materials CASCADE;
DROP VIEW IF EXISTS semo.gfp_research_tasks CASCADE;
DROP VIEW IF EXISTS semo.gfp_infra_requests CASCADE;

ALTER TABLE semo.service_projects RENAME TO services;

-- ============================================================
-- B. PK/FK 컬럼 리네이밍: gfp_id / project_id → service_id
-- ============================================================

-- B-1. 메인 테이블 PK
ALTER TABLE semo.services RENAME COLUMN gfp_id TO service_id;

-- B-2. 자식 테이블 (gfp_id → service_id)
ALTER TABLE semo.service_sections RENAME COLUMN gfp_id TO service_id;
ALTER TABLE semo.service_materials RENAME COLUMN gfp_id TO service_id;
ALTER TABLE semo.service_research_tasks RENAME COLUMN gfp_id TO service_id;
ALTER TABLE semo.service_infra_requests RENAME COLUMN gfp_id TO service_id;

-- B-3. 자식 테이블 (project_id → service_id)
ALTER TABLE semo.service_iterations RENAME COLUMN project_id TO service_id;
ALTER TABLE semo.service_incidents RENAME COLUMN project_id TO service_id;
ALTER TABLE semo.service_features RENAME COLUMN project_id TO service_id;

-- ============================================================
-- C. 제약조건 리네이밍
-- ============================================================

-- C-1. services 테이블
ALTER TABLE semo.services
  RENAME CONSTRAINT gfp_projects_pkey TO services_pkey;
ALTER TABLE semo.services
  RENAME CONSTRAINT service_projects_ontology_domain_fkey TO services_ontology_domain_fkey;

-- C-2. service_sections
ALTER TABLE semo.service_sections
  RENAME CONSTRAINT service_sections_gfp_id_track_phase_section_key_key
  TO service_sections_service_id_track_phase_section_key_key;
ALTER TABLE semo.service_sections
  RENAME CONSTRAINT service_sections_project_fkey TO service_sections_service_fkey;

-- C-3. service_materials
ALTER TABLE semo.service_materials
  RENAME CONSTRAINT service_materials_project_fkey TO service_materials_service_fkey;

-- C-4. service_research_tasks
ALTER TABLE semo.service_research_tasks
  RENAME CONSTRAINT service_research_tasks_project_fkey TO service_research_tasks_service_fkey;

-- C-5. service_infra_requests
ALTER TABLE semo.service_infra_requests
  RENAME CONSTRAINT service_infra_requests_project_fkey TO service_infra_requests_service_fkey;

-- C-6. service_iterations
ALTER TABLE semo.service_iterations
  RENAME CONSTRAINT service_iterations_project_id_fkey TO service_iterations_service_fkey;

-- C-7. service_incidents
ALTER TABLE semo.service_incidents
  RENAME CONSTRAINT service_incidents_project_id_fkey TO service_incidents_service_fkey;

-- C-8. service_features
ALTER TABLE semo.service_features
  RENAME CONSTRAINT service_features_project_id_fkey TO service_features_service_fkey;

-- C-9. 인덱스 리네이밍 (project → service)
ALTER INDEX semo.idx_service_sections_project RENAME TO idx_service_sections_service;
ALTER INDEX semo.idx_service_infra_requests_project RENAME TO idx_service_infra_requests_service;
ALTER INDEX semo.idx_service_iterations_project RENAME TO idx_service_iterations_service;
ALTER INDEX semo.idx_service_incidents_project RENAME TO idx_service_incidents_service;
ALTER INDEX semo.idx_service_features_project RENAME TO idx_service_features_service;

-- (PK constraint rename이 backing index도 자동 rename하므로 별도 인덱스 rename 불필요)

-- ============================================================
-- D. 트리거 리네이밍
-- ============================================================

ALTER TRIGGER trg_service_projects_updated ON semo.services
  RENAME TO trg_services_updated;

-- ============================================================
-- E. 하위 호환 VIEW (gfp_id alias 포함)
-- ============================================================

-- service_projects → services (gfp_id alias)
CREATE VIEW semo.service_projects AS
  SELECT service_id AS gfp_id,
         project_name, service_domain, owner_name, owner_contact,
         current_phase, infra_phase, status, lifecycle, launched_at,
         metadata, created_at, updated_at
  FROM semo.services;

-- gfp_projects → services (레거시)
CREATE VIEW semo.gfp_projects AS
  SELECT * FROM semo.service_projects;

-- gfp_phase_sections → service_sections (gfp_id alias)
CREATE VIEW semo.gfp_phase_sections AS
  SELECT service_id AS gfp_id,
         section_id, phase, track, section_key, title, content,
         ordinal, status, reviewer_note, source,
         kb_written_at, qa_items, slack_thread_ts,
         iteration_id, created_at, updated_at
  FROM semo.service_sections;

-- gfp_materials → service_materials (gfp_id alias)
CREATE VIEW semo.gfp_materials AS
  SELECT service_id AS gfp_id,
         material_id, content, phase_mapping, material_type,
         screenshot_data, stitch_share_url, created_at
  FROM semo.service_materials;

-- gfp_research_tasks → service_research_tasks (gfp_id alias)
CREATE VIEW semo.gfp_research_tasks AS
  SELECT service_id AS gfp_id,
         task_id, task_type, reference_urls, input_prompt,
         status, result, created_at, updated_at
  FROM semo.service_research_tasks;

-- gfp_infra_requests → service_infra_requests (gfp_id alias)
CREATE VIEW semo.gfp_infra_requests AS
  SELECT service_id AS gfp_id,
         request_id, source_phase, source_section_id, category,
         title, description, priority, status,
         slack_thread_ts, created_at, updated_at
  FROM semo.service_infra_requests;

COMMIT;
