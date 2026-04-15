-- 096: KB pipeline keys 등록
-- service_* 테이블 → KB 이식을 위한 type schema 키 등록
-- Phase 0: 선행 조건 — 새 KB 키들을 service 타입에 등록

-- 파이프라인 워크플로우 키 (PM 파이프라인이 관리)
INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type, source)
VALUES
  ('service', 'pipeline', '프로젝트 파이프라인 워크플로우 상태 (phase, lifecycle, preset 등)', false,
   'metadata: {current_phase, infra_phase, lifecycle, service_type, parent_domain, preset, design_step}',
   30, 'singleton', 'pipeline'),
  ('service', 'section', '파이프라인 섹션 (phase별 콘텐츠 블록)', false,
   'sub_key: {track}/{phase}/{section_key}. metadata: {title, ordinal, status, source, qa_items}',
   31, 'collection', 'pipeline'),
  ('service', 'material', '프로젝트 산출물 (기획서, 디자인 export 등)', false,
   'sub_key: {material_id}. metadata: {material_type, phase_mapping}',
   32, 'collection', 'manual'),
  ('service', 'feature', '서비스 기능 카탈로그', false,
   'sub_key: {feature_slug}. metadata: {name, category, status, spec}',
   33, 'collection', 'pipeline'),
  ('service', 'iteration', '운영 이터레이션 (스프린트)', false,
   'sub_key: {title_slug}. metadata: {status, goal, started_at, completed_at}',
   34, 'collection', 'manual'),
  ('service', 'incident', '운영 인시던트', false,
   'sub_key: {YYYY-MM-DD}/{title_slug}. metadata: {severity, status, root_cause, resolution}',
   35, 'collection', 'manual'),
  ('service', 'infra-request', '인프라 요청', false,
   'sub_key: {request_id}. metadata: {category, priority, status}',
   36, 'collection', 'pipeline'),
  ('service', 'research', '리서치 태스크', false,
   'sub_key: {task_id}. metadata: {task_type, status, reference_urls}',
   37, 'collection', 'pipeline'),
  ('service', 'session', '파이프라인 대화 세션 (discovery, conversation)', false,
   'sub_key: {type}/{session_id}. metadata: 세션 상태',
   38, 'collection', 'pipeline'),
  ('service', 'deploy-verify', '배포 검증 결과', false,
   'sub_key: {infra_phase}/{YYYY-MM-DD}. metadata: {checks, overall_status, verified_by}',
   39, 'collection', 'pipeline')
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  scheme_description = EXCLUDED.scheme_description,
  value_hint = EXCLUDED.value_hint,
  sort_order = EXCLUDED.sort_order,
  key_type = EXCLUDED.key_type,
  source = EXCLUDED.source;

-- source 컬럼에 'pipeline' 값 허용 (기존: 'manual', 'projection')
-- CHECK 제약이 있을 경우 대비 — 없으면 무시됨
DO $$
DECLARE
  _conname text;
BEGIN
  -- kb_type_schema.source 컬럼에 CHECK 제약이 있는지 확인 후 'pipeline' 허용으로 확장
  SELECT c.conname INTO _conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'semo' AND t.relname = 'kb_type_schema'
    AND c.contype = 'c' AND c.conname LIKE '%source%'
  LIMIT 1;

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE semo.kb_type_schema DROP CONSTRAINT %I', _conname);
    ALTER TABLE semo.kb_type_schema
      ADD CONSTRAINT kb_type_schema_source_check
      CHECK (source IN ('manual', 'projection', 'pipeline'));
  END IF;
END $$;
