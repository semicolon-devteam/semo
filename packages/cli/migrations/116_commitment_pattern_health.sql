-- 116_commitment_pattern_health.sql
-- 2026-05-06: PAL 스타일 패턴 단위 실패 누적 추적 (C3 of Ouroboros adoption).
-- Ouroboros routing/escalation.py 의 EscalationManager 패턴을 SEMO 에 변형 차용.
-- 검증 근거: /tmp/ouroboros-sandbox/evidence/c3_results.json — 실 SEMO failed
-- commitment 500개 replay 시 16 escalation + 432 stagnation, 7 cron 패턴이 Frontier
-- 까지 도달 (cron poller 250x, commitment-watchdog 71x 등 침묵 실패 누적).
--
-- 이번 마이그레이션은 추적 스키마만 도입한다. 알림 부수효과(Slack DM, #bot-ops 포스팅)
-- 는 PR2 에서 슬랙 라우터에 부착. 이 PR 은 신호를 DB 에 적재하고, fail/done 전이에서
-- 카운터를 갱신하는 데까지만 한다 — 회귀 0.

-- ── pattern health 추적 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semo.commitment_pattern_health (
  -- 패턴 키: "{bot_id}::{canonical_prefix}#{hash}".
  --   - canonical_prefix: title 을 NFKC + invisibles strip + whitespace collapse +
  --     lowercase 후 첫 60 code point.
  --   - hash: sha256(canonical title) 의 첫 10 hex — prefix 가 같지만 본문이 다른
  --     title 들을 분리.
  -- 키 생성/정규화 SoT 는 packages/cli/src/commitment-escalation.ts.
  pattern_id TEXT PRIMARY KEY,

  bot_id TEXT NOT NULL,
  title_prefix TEXT NOT NULL,

  consecutive_failures INTEGER NOT NULL DEFAULT 0
    CHECK (consecutive_failures >= 0),

  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,

  -- 에스컬레이션 상태머신: none → notified (2 fails) → paged (5 fails)
  -- 성공 시 즉시 'none' 으로 리셋. 알림 부수효과는 PR2.
  state TEXT NOT NULL DEFAULT 'none'
    CHECK (state IN ('none', 'notified', 'paged')),

  -- 상태 전환을 마지막으로 관측한 시각. 진단/대시보드용.
  -- ⚠ 알림 dedup 용도로는 신뢰하지 말 것 — 동시 실패 호출 시 두 트랜잭션 모두
  --   "전이 발생" 으로 관측될 수 있다. PR2 에서 별도 claim 컬럼 또는
  --   notification dedup 테이블로 idempotency 를 잡는다.
  state_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE semo.commitment_pattern_health IS
  '봇 약속의 (bot_id, title_prefix) 패턴별 연속 실패 누적과 에스컬레이션 상태. '
  'Ouroboros C3 (PAL escalation 변형). 2026-05-06 추가.';

COMMENT ON COLUMN semo.commitment_pattern_health.pattern_id IS
  '"{bot_id}::{canonical_prefix}#{sha256_10}". canonical = NFKC + invisibles strip + '
  'whitespace collapse + lowercase. SoT: packages/cli/src/commitment-escalation.ts.';

COMMENT ON COLUMN semo.commitment_pattern_health.state IS
  'none | notified (2회 연속 실패) | paged (5회 연속 실패). '
  '성공 1회로 즉시 none 으로 reset.';

-- 활성 escalation 모니터링 인덱스 — paged 상태 패턴이 가장 시급.
CREATE INDEX IF NOT EXISTS idx_commitment_pattern_health_active_state
  ON semo.commitment_pattern_health (state, last_failure_at DESC)
  WHERE state <> 'none';

-- bot 별 health 조회 (대시보드용).
CREATE INDEX IF NOT EXISTS idx_commitment_pattern_health_bot_id
  ON semo.commitment_pattern_health (bot_id);

-- updated_at 자동 갱신 트리거 — bot_commitments 와 동일 컨벤션.
CREATE OR REPLACE FUNCTION semo.fn_commitment_pattern_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commitment_pattern_health_updated
  ON semo.commitment_pattern_health;

CREATE TRIGGER trg_commitment_pattern_health_updated
  BEFORE UPDATE ON semo.commitment_pattern_health
  FOR EACH ROW EXECUTE FUNCTION semo.fn_commitment_pattern_health_updated_at();
