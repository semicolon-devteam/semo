-- 014_timestamp_to_timestamptz.sql
-- Fix timezone double-conversion bug: TIMESTAMP → TIMESTAMPTZ
--
-- DB session timezone = Asia/Seoul (KST).
-- Application-provided timestamps (last_active, last_activity, last_run, next_run)
--   were stored from toISOString() with 'Z' stripped → raw UTC digits.
-- Database-generated timestamps (synced_at via NOW())
--   were stored as KST digits.

-- bot_status
ALTER TABLE semo.bot_status
  ALTER COLUMN last_active TYPE TIMESTAMPTZ USING last_active AT TIME ZONE 'UTC',
  ALTER COLUMN synced_at   TYPE TIMESTAMPTZ USING synced_at   AT TIME ZONE 'Asia/Seoul';

ALTER TABLE semo.bot_status
  ALTER COLUMN synced_at SET DEFAULT NOW();

-- bot_sessions
ALTER TABLE semo.bot_sessions
  ALTER COLUMN last_activity TYPE TIMESTAMPTZ USING last_activity AT TIME ZONE 'UTC',
  ALTER COLUMN synced_at     TYPE TIMESTAMPTZ USING synced_at     AT TIME ZONE 'Asia/Seoul';

ALTER TABLE semo.bot_sessions
  ALTER COLUMN synced_at SET DEFAULT NOW();

-- bot_cron_jobs
ALTER TABLE semo.bot_cron_jobs
  ALTER COLUMN last_run  TYPE TIMESTAMPTZ USING last_run  AT TIME ZONE 'UTC',
  ALTER COLUMN next_run  TYPE TIMESTAMPTZ USING next_run  AT TIME ZONE 'UTC',
  ALTER COLUMN synced_at TYPE TIMESTAMPTZ USING synced_at AT TIME ZONE 'Asia/Seoul';

ALTER TABLE semo.bot_cron_jobs
  ALTER COLUMN synced_at SET DEFAULT NOW();
