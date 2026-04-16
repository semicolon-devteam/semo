-- 102: bot_cost_log에 세션/메시지 ID 추가 — Stop 훅 기반 턴별 토큰 추적 dedup용

ALTER TABLE semo.bot_cost_log
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_log_dedup
  ON semo.bot_cost_log (session_id, message_id)
  WHERE message_id IS NOT NULL;
