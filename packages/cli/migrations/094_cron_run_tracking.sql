-- 062: Cron Run Tracking
-- bot_cron_jobs에 실행 결과 rollup 3컬럼 추가 + 신규 append-only bot_cron_runs 이력 테이블

ALTER TABLE semo.bot_cron_jobs
  ADD COLUMN IF NOT EXISTS last_status TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS semo.bot_cron_runs (
  id            BIGSERIAL PRIMARY KEY,
  bot_id        TEXT NOT NULL,
  job_id        TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK (status IN ('success','failure','timeout','skipped')),
  error         TEXT,
  output_digest TEXT,
  session_owner TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bot_cron_runs_job
  ON semo.bot_cron_runs(bot_id, job_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_cron_runs_failure
  ON semo.bot_cron_runs(status, started_at DESC)
  WHERE status IN ('failure','timeout');
