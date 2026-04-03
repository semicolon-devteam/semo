-- 050: service_kpi_metrics & service_action_items
--
-- KPI 지표와 액션 아이템을 개별 레코드로 관리.
-- KB markdown blob → DB 구조화 레코드 전환.
--
-- 선행 조건: 046_service_ops_tables.sql (iterations, incidents)

BEGIN;

-- ============================================================
-- 1. service_kpi_metrics — 개별 KPI 지표 레코드
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.service_kpi_metrics (
  metric_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES semo.service_projects(gfp_id) ON DELETE CASCADE,
  iteration_id    UUID REFERENCES semo.service_iterations(iteration_id),
  period          DATE NOT NULL,
  metric_name     VARCHAR(100) NOT NULL,
  metric_label    VARCHAR(200),
  category        VARCHAR(50) NOT NULL DEFAULT 'common',
  current_value   NUMERIC,
  baseline_value  NUMERIC,
  target_value    NUMERIC,
  unit            VARCHAR(30),
  wow_change      NUMERIC,
  signal          VARCHAR(10) NOT NULL DEFAULT 'neutral',
  achieved        BOOLEAN DEFAULT FALSE,
  source          VARCHAR(50) DEFAULT 'bot',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- category: common | service-specific | search | engagement
-- signal: green | yellow | red | neutral
-- source: bot | manual | api | import

CREATE INDEX idx_service_kpi_metrics_project_period
  ON semo.service_kpi_metrics(project_id, period DESC);

CREATE INDEX idx_service_kpi_metrics_lookup
  ON semo.service_kpi_metrics(project_id, metric_name, period DESC);

CREATE TRIGGER trg_service_kpi_metrics_updated
  BEFORE UPDATE ON semo.service_kpi_metrics
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

-- ============================================================
-- 2. service_action_items — 개별 액션 아이템 레코드
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.service_action_items (
  action_item_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES semo.service_projects(gfp_id) ON DELETE CASCADE,
  iteration_id    UUID REFERENCES semo.service_iterations(iteration_id),
  description     TEXT NOT NULL,
  assignee        VARCHAR(100),
  deadline        DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
  category        VARCHAR(50),
  source          VARCHAR(50) DEFAULT 'manual',
  related_url     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- status: open | completed | cancelled
-- priority: low | normal | high | urgent
-- source: manual | bot | dashboard | import

CREATE INDEX idx_service_action_items_project_status
  ON semo.service_action_items(project_id, status);

CREATE INDEX idx_service_action_items_assignee
  ON semo.service_action_items(assignee, status)
  WHERE assignee IS NOT NULL;

CREATE TRIGGER trg_service_action_items_updated
  BEFORE UPDATE ON semo.service_action_items
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

COMMIT;
