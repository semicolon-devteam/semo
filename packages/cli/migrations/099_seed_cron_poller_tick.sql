-- 099: cron-poller-tick 메타 잡 seed
-- Phase 1 폴러가 매 분 자기 heartbeat 을 mark-run 으로 기록하기 위한 대상.
-- semiclaw 봇에 FK 매핑, schedule '* * * * *', skip_dispatch 플래그로 tick WHERE 제외.

INSERT INTO semo.bot_cron_jobs (bot_id, job_id, name, schedule, enabled, payload)
VALUES (
  'semiclaw',
  'cron-poller-tick',
  'SEMO cron poller heartbeat',
  '{"kind":"cron","expr":"* * * * *"}'::jsonb,
  TRUE,
  '{"report_channel":"#bot-ops","skip_dispatch":true,"meta":"cron-poller"}'::jsonb
)
ON CONFLICT (bot_id, job_id) DO NOTHING;
