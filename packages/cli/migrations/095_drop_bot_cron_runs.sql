-- 095: bot_cron_runs 폐기 (commitment 통합)
-- cron 실행은 bot_commitments(source_type='cron')으로 기록한다.
-- bot_cron_jobs.last_status / last_error / consecutive_failures rollup 컬럼은 유지.

DROP INDEX IF EXISTS semo.idx_bot_cron_runs_failure;
DROP INDEX IF EXISTS semo.idx_bot_cron_runs_job;
DROP TABLE IF EXISTS semo.bot_cron_runs;
