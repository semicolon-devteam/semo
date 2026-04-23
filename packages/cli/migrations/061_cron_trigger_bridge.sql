-- 061: Cron Trigger Bridge
-- bot_cron_jobs 테이블에 RemoteTrigger 연동 컬럼 추가

ALTER TABLE semo.bot_cron_jobs
  ADD COLUMN IF NOT EXISTS trigger_id TEXT,
  ADD COLUMN IF NOT EXISTS deploy_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_deploy_at TIMESTAMPTZ;
