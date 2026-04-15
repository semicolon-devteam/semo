-- 100: Phase 4 — services 허브 테이블 (17건) KB 이식 + DROP
-- 코드는 이미 KB pipeline/config 기반으로 전환됨

-- 1. services → KB pipeline/config
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM semo.services WHERE service_domain IS NOT NULL LOOP
    INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by, metadata)
    VALUES (
      rec.service_domain, 'pipeline', 'config',
      COALESCE(rec.project_name, ''),
      'migration-100',
      jsonb_build_object(
        'service_id', rec.service_id,
        'project_name', COALESCE(rec.project_name, ''),
        'owner_name', COALESCE(rec.owner_name, ''),
        'owner_contact', rec.owner_contact,
        'current_phase', COALESCE(rec.current_phase, 0),
        'infra_phase', rec.infra_phase,
        'status', COALESCE(rec.status, 'active'),
        'lifecycle', COALESCE(rec.lifecycle, 'build'),
        'service_type', COALESCE(rec.service_type, 'incubator'),
        'parent_service_id', rec.parent_service_id,
        'tech_stack', rec.tech_stack,
        'service_url', rec.service_url,
        'bm', rec.bm,
        'repo', rec.repo,
        'slack_channel', rec.slack_channel,
        'launched_at', rec.launched_at::text,
        'project_metadata', COALESCE(rec.metadata, '{}'::jsonb),
        'created_at', rec.created_at::text
      )
    )
    ON CONFLICT (domain, key, sub_key) DO UPDATE SET
      content = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
  END LOOP;
END $$;

-- 2. 레거시 VIEW DROP
DROP VIEW IF EXISTS semo.service_projects CASCADE;
DROP VIEW IF EXISTS semo.gfp_projects CASCADE;
DROP VIEW IF EXISTS semo.gfp_phase_sections CASCADE;
DROP VIEW IF EXISTS semo.gfp_materials CASCADE;
DROP VIEW IF EXISTS semo.gfp_research_tasks CASCADE;
DROP VIEW IF EXISTS semo.gfp_infra_requests CASCADE;

-- 3. services 테이블 DROP → 101_drop_services.sql로 분리
-- sandbox.ts 에서 semo.services 참조(8곳)가 KB 전환 완료된 후 실행
