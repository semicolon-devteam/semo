-- 059: Incubator Sessions 테이블
-- 인큐베이터 프로젝트별 Claude Code 세션 관리

CREATE TABLE IF NOT EXISTS semo.incubator_sessions (
  service_id   TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  channel      TEXT,                                    -- Slack 채널명
  session_dir  TEXT NOT NULL,                           -- 로컬 세션 디렉토리 경로
  status       TEXT NOT NULL DEFAULT 'active'           -- active | stopped | archived
                    CHECK (status IN ('active', 'stopped', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 상태 변경 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION semo.update_incubator_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incubator_sessions_updated ON semo.incubator_sessions;
CREATE TRIGGER trg_incubator_sessions_updated
  BEFORE UPDATE ON semo.incubator_sessions
  FOR EACH ROW EXECUTE FUNCTION semo.update_incubator_sessions_timestamp();

COMMENT ON TABLE semo.incubator_sessions IS '인큐베이터 프로젝트별 Claude Code 세션 메타데이터';
