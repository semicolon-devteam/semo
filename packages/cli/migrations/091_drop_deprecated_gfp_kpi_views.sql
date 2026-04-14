-- 091: 레거시 호환 VIEW + deprecated 테이블/컬럼 최종 제거
--
-- 선행 조건:
--   045/052: gfp_* → service_* 테이블 리네임 + 호환 VIEW 생성
--   069: action_items 리네임 + service_action_items VIEW 생성
--   084: service_kpi_metrics deprecated (KB metadata가 SoT)
--   085: meetings.service_id deprecated (target_domain 대체)
--
-- 코드 참조 제거 확인:
--   - gfp_* VIEW: 코드 참조 0건 (service_* 직접 참조로 전환)
--   - service_kpi_metrics: DB fallback 코드 제거됨 (KB-only)
--   - meetings.service_id: 코드에서 완전 제거됨
--
-- 사전 백업 권장:
--   pg_dump --table=semo.service_kpi_metrics -f backup_kpi_metrics.sql

BEGIN;

-- ── Guard: meetings.service_id 마이그레이션 완료 확인 (멱등) ──
DO $$
DECLARE
  col_exists BOOLEAN;
  unmigrated INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'semo' AND table_name = 'meetings' AND column_name = 'service_id'
  ) INTO col_exists;

  IF NOT col_exists THEN
    RAISE NOTICE 'service_id column already dropped — skipping guard';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO unmigrated
  FROM semo.meetings
  WHERE service_id IS NOT NULL AND target_domain IS NULL;
  IF unmigrated > 0 THEN
    RAISE EXCEPTION '% meetings still have service_id without target_domain — run 085 data migration first', unmigrated;
  END IF;
END $$;

-- ── 1. 레거시 호환 VIEW 제거 (의존 순서 준수) ──

-- gfp_projects가 service_projects를 참조하므로 먼저 제거
DROP VIEW IF EXISTS semo.gfp_projects CASCADE;
DROP VIEW IF EXISTS semo.gfp_phase_sections CASCADE;
DROP VIEW IF EXISTS semo.gfp_materials CASCADE;
DROP VIEW IF EXISTS semo.gfp_research_tasks CASCADE;
DROP VIEW IF EXISTS semo.gfp_infra_requests CASCADE;

-- gfp_projects 제거 후 안전하게 제거 가능
DROP VIEW IF EXISTS semo.service_projects CASCADE;
DROP VIEW IF EXISTS semo.service_action_items CASCADE;

-- ── 2. service_kpi_metrics 테이블 제거 ──
-- leaf 테이블 (incoming FK 없음). 인덱스 2개 + 트리거 자동 제거.
DROP TABLE IF EXISTS semo.service_kpi_metrics;

-- ── 3. meetings.service_id 컬럼 제거 ──
DROP INDEX IF EXISTS semo.idx_meetings_service;
ALTER TABLE semo.meetings DROP CONSTRAINT IF EXISTS meetings_service_id_fkey;
ALTER TABLE semo.meetings DROP COLUMN IF EXISTS service_id;

COMMIT;
