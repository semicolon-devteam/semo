-- 035_bot_budgets.sql
-- 봇 예산 관리 + 비용 집계 뷰
-- Paperclip 컨셉 통합: 에이전트별 월간 예산 + 자동 정지

BEGIN;

-- ============================================================
-- 1. bot_budgets — 봇별 월간 예산 설정
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.bot_budgets (
  bot_id              TEXT PRIMARY KEY REFERENCES semo.bot_status(bot_id),
  monthly_budget_usd  NUMERIC(10,2),
  alert_threshold_pct INT NOT NULL DEFAULT 80,
  auto_pause          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. bot_cost_summary — 월별 비용 집계 뷰
-- ============================================================

CREATE OR REPLACE VIEW semo.bot_cost_summary AS
SELECT
  bot_id,
  date_trunc('month', created_at)::date AS month,
  COUNT(*) AS query_count,
  COALESCE(SUM(token_input), 0) AS total_input_tokens,
  COALESCE(SUM(token_output), 0) AS total_output_tokens,
  COALESCE(SUM((metadata->>'cost_usd')::numeric), 0) AS total_cost_usd,
  COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms
FROM semo.bot_query_logs
GROUP BY bot_id, date_trunc('month', created_at);

-- ============================================================
-- 3. bot_cost_daily — 일별 비용 집계 뷰 (트렌드용)
-- ============================================================

CREATE OR REPLACE VIEW semo.bot_cost_daily AS
SELECT
  bot_id,
  created_at::date AS day,
  COUNT(*) AS query_count,
  COALESCE(SUM(token_input), 0) AS total_input_tokens,
  COALESCE(SUM(token_output), 0) AS total_output_tokens,
  COALESCE(SUM((metadata->>'cost_usd')::numeric), 0) AS total_cost_usd
FROM semo.bot_query_logs
GROUP BY bot_id, created_at::date;

COMMIT;
