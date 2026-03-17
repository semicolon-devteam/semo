-- 003_add_fk.sql
-- P1-3: FK 제약 추가

-- bot_sessions.bot_id → bot_status.bot_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sessions_bot'
      AND table_schema = 'semo'
  ) THEN
    ALTER TABLE semo.bot_sessions
      ADD CONSTRAINT fk_sessions_bot
      FOREIGN KEY (bot_id) REFERENCES semo.bot_status(bot_id) ON DELETE CASCADE;
  END IF;
END $$;

-- bot_cron_jobs.bot_id → bot_status.bot_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cron_jobs_bot'
      AND table_schema = 'semo'
  ) THEN
    ALTER TABLE semo.bot_cron_jobs
      ADD CONSTRAINT fk_cron_jobs_bot
      FOREIGN KEY (bot_id) REFERENCES semo.bot_status(bot_id) ON DELETE CASCADE;
  END IF;
END $$;

-- bot_query_logs는 FK 제외 — 로그 테이블은 참조 무결성보다 적재 안정성 우선
