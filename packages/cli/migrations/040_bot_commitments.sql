BEGIN;

CREATE TABLE IF NOT EXISTS semo.bot_commitments (
  id              TEXT PRIMARY KEY,          -- "cmt-{botId}-{timestamp}-{rand4}"
  bot_id          TEXT NOT NULL,             -- FK 논리적: semo.bot_status.bot_id
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- pending → active → done | failed | expired
  title           TEXT NOT NULL,             -- "Typography+Layout+Imagery+Motion 섹션 생성"
  description     TEXT,
  source_type     VARCHAR(30),               -- 'github-issue' | 'slack' | 'cron' | 'manual'
  source_ref      TEXT,                      -- "semicolon-devteam/repo#42" or channel:thread
  deadline_at     TIMESTAMPTZ,
  steps           JSONB DEFAULT '[]'::jsonb, -- [{"label":"Typography","done":false}]
  metadata        JSONB DEFAULT '{}'::jsonb, -- 확장용 (session_key, fail_reason, notes 등)
  last_heartbeat_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- 활성 커밋먼트 조회 인덱스 (watchdog 최적화)
CREATE INDEX IF NOT EXISTS idx_commitments_active
  ON semo.bot_commitments (status, deadline_at)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_commitments_bot
  ON semo.bot_commitments (bot_id, status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION semo.trg_commitments_updated()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_commitments_updated
  BEFORE UPDATE ON semo.bot_commitments
  FOR EACH ROW EXECUTE FUNCTION semo.trg_commitments_updated();

-- 완료 시 completed_at 자동 채움
CREATE OR REPLACE FUNCTION semo.trg_commitments_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('done','failed','expired') AND OLD.status NOT IN ('done','failed','expired') THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_commitments_completed
  BEFORE UPDATE ON semo.bot_commitments
  FOR EACH ROW EXECUTE FUNCTION semo.trg_commitments_completed();

-- 워치독용 뷰
CREATE OR REPLACE VIEW semo.v_active_commitments AS
SELECT c.*,
  CASE
    WHEN c.deadline_at IS NOT NULL AND c.deadline_at < NOW() THEN 'overdue'
    WHEN c.last_heartbeat_at IS NOT NULL
         AND c.last_heartbeat_at < NOW() - INTERVAL '30 minutes' THEN 'stale'
    ELSE 'on-track'
  END AS health,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(c.last_heartbeat_at, c.created_at))) / 60.0
    AS minutes_since_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - c.deadline_at)) / 60.0
    AS minutes_overdue
FROM semo.bot_commitments c
WHERE c.status IN ('pending', 'active');

COMMIT;
