-- 049: service_features — 서비스 기능 관리 테이블
--
-- 운영 중인 서비스의 기능 목록을 DB 기반으로 관리.
-- 계층 구조(parent_id), 카테고리별 분류, 기능 개선 → GitHub Issue 연동.
--
-- 선행 조건: 045_service_table_rename_and_projection.sql

BEGIN;

CREATE TABLE IF NOT EXISTS semo.service_features (
  feature_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES semo.service_projects(gfp_id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  category    VARCHAR(50) NOT NULL DEFAULT 'core',
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  parent_id   UUID REFERENCES semo.service_features(feature_id) ON DELETE SET NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- category: core | growth | infra | ux | integration
-- status: active | planned | in-dev | deprecated
-- metadata: { endpoints: [], github_issue_url, tech_notes }

CREATE INDEX idx_service_features_project
  ON semo.service_features(project_id, category, sort_order);

CREATE INDEX idx_service_features_parent
  ON semo.service_features(parent_id)
  WHERE parent_id IS NOT NULL;

CREATE TRIGGER trg_service_features_updated
  BEFORE UPDATE ON semo.service_features
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

COMMIT;
