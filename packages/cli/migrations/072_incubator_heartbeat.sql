-- 072: Incubator Sessions Heartbeat
-- channel-slack이 주기적으로 heartbeat를 전송하여 세션 활성 상태를 증명.
-- orchestrator는 heartbeat가 stale인 세션을 자동 정리하여 중복 응답 방지.

ALTER TABLE semo.incubator_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS heartbeat_stale_threshold_sec INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_incubator_heartbeat
  ON semo.incubator_sessions(status, last_heartbeat)
  WHERE status = 'active';
