-- 069: bot_cost_log에 토큰 추적 컬럼 추가 + 비용 뷰를 bot_cost_log 기반으로 전환
-- Agent SDK SDKResultMessage.usage.apiUsage에서 토큰 데이터 기록

BEGIN;

-- 1. 토큰 컬럼 추가
ALTER TABLE semo.bot_cost_log
  ADD COLUMN IF NOT EXISTS input_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_turns INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_ms INT;

-- 2. service_id 인덱스 (프로젝트별 비용 집계용)
CREATE INDEX IF NOT EXISTS idx_cost_log_service
  ON semo.bot_cost_log (service_id) WHERE service_id IS NOT NULL;

-- 3. 기존 뷰 DROP 후 bot_cost_log 기반으로 재생성 (레거시 bot_query_logs → bot_cost_log)
-- bot_id 타입이 다를 수 있으므로 CREATE OR REPLACE 대신 DROP + CREATE
DROP VIEW IF EXISTS semo.bot_cost_summary;
DROP VIEW IF EXISTS semo.bot_cost_daily;

CREATE VIEW semo.bot_cost_summary AS
SELECT bot_id,
       date_trunc('month', created_at)::date AS month,
       COUNT(*) AS query_count,
       COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
       COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
       COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
       COALESCE(AVG(duration_ms), 0)::int AS avg_latency_ms
FROM semo.bot_cost_log
GROUP BY bot_id, date_trunc('month', created_at);

CREATE VIEW semo.bot_cost_daily AS
SELECT bot_id,
       created_at::date AS day,
       COUNT(*) AS query_count,
       COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
       COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
       COALESCE(SUM(cost_usd), 0) AS total_cost_usd
FROM semo.bot_cost_log
GROUP BY bot_id, created_at::date;

COMMIT;
