-- 036_gfp_stitch_design.sql
-- GFP Phase 3 (Design System) + Stitch 브릿지 지원
--
-- 1. gfp_materials에 material_type 컬럼 추가 (planning-doc | stitch-export)
-- 2. DesignClaw를 gfp-manager 스킬 사용 봇에 추가

BEGIN;

-- ============================================================
-- 1. gfp_materials.material_type 컬럼
-- ============================================================
ALTER TABLE semo.gfp_materials
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(50) DEFAULT 'planning-doc';

COMMENT ON COLUMN semo.gfp_materials.material_type IS
  'Material type: planning-doc (기존 기획안), stitch-export (Stitch CSS export)';

-- ============================================================
-- 2. gfp-manager 스킬에 designclaw 봇 추가
-- ============================================================
UPDATE semo.skill_definitions
  SET metadata = jsonb_set(
    metadata,
    '{bot_ids}',
    (metadata->'bot_ids') || '["designclaw"]'::jsonb
  )
WHERE name = 'gfp-manager'
  AND NOT (metadata->'bot_ids' @> '"designclaw"'::jsonb);

-- ============================================================
-- 3. GfpSectionSource에 'designclaw' 허용 (CHECK 제약이 없으면 무시)
-- ============================================================
-- gfp_phase_sections.source는 VARCHAR이므로 별도 제약 없이 'designclaw' 값 사용 가능

COMMIT;
