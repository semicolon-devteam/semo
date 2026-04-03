-- 046: Service Ops Phase Tables — 운영 라이프사이클 확장
--
-- build → ops → sunset 전환을 위한 이터레이션/인시던트 테이블.
-- service_sections.iteration_id로 build/ops phase 섹션을 구분.
--
-- 선행 조건: 045_service_table_rename_and_projection.sql 적용 완료

BEGIN;

-- ============================================================
-- 1. service_iterations — 운영 이터레이션 사이클
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.service_iterations (
  iteration_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES semo.service_projects(gfp_id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  goal          TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'planned',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  retrospective TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- status: planned | active | completed
CREATE INDEX idx_service_iterations_project
  ON semo.service_iterations(project_id, status);

-- updated_at 트리거 연결
CREATE TRIGGER trg_service_iterations_updated
  BEFORE UPDATE ON semo.service_iterations
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

-- ============================================================
-- 2. service_incidents — 운영 인시던트
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.service_incidents (
  incident_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES semo.service_projects(gfp_id) ON DELETE CASCADE,
  iteration_id  UUID REFERENCES semo.service_iterations(iteration_id),
  severity      VARCHAR(10) NOT NULL DEFAULT 'medium',
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  root_cause    TEXT,
  resolution    TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'open',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- severity: low | medium | high | critical
-- status: open | investigating | resolved | postmortem
CREATE INDEX idx_service_incidents_project
  ON semo.service_incidents(project_id, status);

CREATE TRIGGER trg_service_incidents_updated
  BEFORE UPDATE ON semo.service_incidents
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

-- ============================================================
-- 3. service_sections.iteration_id — ops phase 섹션 연결
-- ============================================================

ALTER TABLE semo.service_sections
  ADD COLUMN IF NOT EXISTS iteration_id UUID REFERENCES semo.service_iterations(iteration_id);

-- iteration_id IS NULL = build phase 섹션 (기존 동작 유지)
-- iteration_id IS NOT NULL = ops phase 작업 항목

COMMIT;
