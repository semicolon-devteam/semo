-- 117_commitment_pattern_alert_claims.sql
-- 2026-05-06: PR2 of Ouroboros C3 — alert claim 컬럼 추가.
--
-- PR1 은 state 전환을 추적했지만 (notified/paged), 동시 실패 호출 시 두 caller
-- 모두 state_changed=true 를 관측할 수 있다 (CTE old 가 pre-lock 값을 읽음).
-- 알림 부수효과는 race-safe 가 아니라는 뜻이다.
--
-- PR2 는 DB-backed claim 으로 idempotency 를 잡는다:
--   - notified_at: 'notified' 상태 진입 후 첫 성공한 claim 시각.
--   - paged_at: 'paged' 상태 진입 후 첫 성공한 claim 시각.
-- claim 패턴: UPDATE … SET notified_at = NOW() WHERE pattern_id = $1
--             AND state = 'notified' AND notified_at IS NULL RETURNING …;
-- 첫 caller 만 row 를 받고 (rowCount=1), 나머지는 0 — 이게 알림 발송 권한.
--
-- success 시 (state → 'none') 두 컬럼 모두 NULL 로 reset 해서, 다음 회복-실패
-- 사이클에서 새 claim 가능.

ALTER TABLE semo.commitment_pattern_health
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paged_at TIMESTAMPTZ;

COMMENT ON COLUMN semo.commitment_pattern_health.notified_at IS
  '"notified" 상태 진입 후 첫 알림 claim 시각. 알림 dedup 용 — '
  'UPDATE … WHERE notified_at IS NULL RETURNING 으로 atomic 발송 권한 결정.';

COMMENT ON COLUMN semo.commitment_pattern_health.paged_at IS
  '"paged" 상태 진입 후 첫 알림 claim 시각. notified_at 와 동일한 dedup 패턴.';

-- 미발송 alert 빠르게 찾기.
CREATE INDEX IF NOT EXISTS idx_commitment_pattern_health_pending_alert
  ON semo.commitment_pattern_health (state, last_failure_at DESC)
  WHERE (state = 'notified' AND notified_at IS NULL)
     OR (state = 'paged' AND paged_at IS NULL);
