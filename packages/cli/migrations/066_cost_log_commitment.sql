-- bot_cost_log에 commitment 연동 컬럼 추가
-- commitment별 비용 집계 및 에스컬레이션 depth 추적

ALTER TABLE semo.bot_cost_log
  ADD COLUMN IF NOT EXISTS commitment_id TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_depth INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cost_log_commitment
  ON semo.bot_cost_log (commitment_id) WHERE commitment_id IS NOT NULL;
