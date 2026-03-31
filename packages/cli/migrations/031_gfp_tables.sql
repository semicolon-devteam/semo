-- 031_gfp_tables.sql
-- GFP (Greenfield Project Pipeline) v2 — Visual Planning Pipeline
-- 4 tables: gfp_projects, gfp_phase_sections, gfp_materials, gfp_research_tasks
--
-- 선행 조건: semo schema 존재

BEGIN;

-- ============================================================
-- 1. gfp_projects — 프로젝트 메타
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.gfp_projects (
  gfp_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name    VARCHAR(200) NOT NULL,
  service_domain  VARCHAR(100),
  owner_name      VARCHAR(100) NOT NULL,
  owner_contact   VARCHAR(200),
  current_phase   SMALLINT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. gfp_phase_sections — 페이즈별 섹션 (핵심 테이블)
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.gfp_phase_sections (
  section_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gfp_id        UUID NOT NULL REFERENCES semo.gfp_projects(gfp_id) ON DELETE CASCADE,
  phase         SMALLINT NOT NULL,
  section_key   VARCHAR(100) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  ordinal       SMALLINT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  reviewer_note TEXT,
  source        VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gfp_id, phase, section_key)
);

CREATE INDEX IF NOT EXISTS idx_gfp_sections_project
  ON semo.gfp_phase_sections(gfp_id, phase, ordinal);

-- ============================================================
-- 3. gfp_materials — 사전 기획안 업로드
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.gfp_materials (
  material_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gfp_id        UUID NOT NULL REFERENCES semo.gfp_projects(gfp_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  phase_mapping JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. gfp_research_tasks — GrowthClaw 리서치
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.gfp_research_tasks (
  task_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gfp_id         UUID NOT NULL REFERENCES semo.gfp_projects(gfp_id) ON DELETE CASCADE,
  task_type      VARCHAR(50) NOT NULL,
  reference_urls TEXT[] DEFAULT '{}',
  input_prompt   TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'queued',
  result         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. updated_at 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION semo.gfp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gfp_projects_updated
  BEFORE UPDATE ON semo.gfp_projects
  FOR EACH ROW EXECUTE FUNCTION semo.gfp_set_updated_at();

CREATE TRIGGER trg_gfp_sections_updated
  BEFORE UPDATE ON semo.gfp_phase_sections
  FOR EACH ROW EXECUTE FUNCTION semo.gfp_set_updated_at();

CREATE TRIGGER trg_gfp_research_updated
  BEFORE UPDATE ON semo.gfp_research_tasks
  FOR EACH ROW EXECUTE FUNCTION semo.gfp_set_updated_at();

COMMIT;
