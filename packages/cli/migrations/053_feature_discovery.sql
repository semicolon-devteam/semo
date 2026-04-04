-- 053: Feature Discovery & Conversation Sessions
-- 기능 발견(크롤링) 및 대화형 기능 생성을 위한 세션 관리 테이블
BEGIN;

-- Feature Discovery Sessions (Playwright 크롤링 기반 기능 발견)
CREATE TABLE IF NOT EXISTS semo.feature_discovery_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES semo.service_projects(service_id) ON DELETE CASCADE,
  source_url    TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'crawling',
  candidates    JSONB DEFAULT '[]',
  confirmed     JSONB DEFAULT '[]',
  screenshots   JSONB DEFAULT '{}',
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- status: crawling | candidates_ready | reviewing | confirmed | failed

CREATE INDEX IF NOT EXISTS idx_fds_service
  ON semo.feature_discovery_sessions(service_id, status);

-- Feature Conversation Sessions (봇 대화형 기능 생성/스펙 보강)
CREATE TABLE IF NOT EXISTS semo.feature_conversation_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES semo.service_projects(service_id) ON DELETE CASCADE,
  mode          VARCHAR(20) NOT NULL DEFAULT 'create',
  status        VARCHAR(20) NOT NULL DEFAULT 'collecting',
  features      JSONB DEFAULT '[]',
  slack_channel TEXT,
  slack_thread_ts TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- mode: create | enrich
-- status: collecting | reviewing | confirmed | cancelled

CREATE INDEX IF NOT EXISTS idx_fcs_service
  ON semo.feature_conversation_sessions(service_id, status);

-- updated_at 트리거
CREATE TRIGGER trg_fds_updated BEFORE UPDATE ON semo.feature_discovery_sessions
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();
CREATE TRIGGER trg_fcs_updated BEFORE UPDATE ON semo.feature_conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION semo.service_set_updated_at();

COMMIT;
