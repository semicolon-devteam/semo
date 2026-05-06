-- 119_commitment_events
--
-- Ouroboros C5 — Event Replay (dual-write phase).
-- 자세한 설계: /tmp/ouroboros-sandbox/evidence/c5_schema_draft.md (action item 4b406bbd)
--   · taxonomy: 8 종 — commitment_created/status_changed/heartbeat/step_done/
--     claimed/released/stale_reaped/cron_run_recorded
--   · idempotency_key UNIQUE — 같은 이벤트 재기록 방지 (재시도 흡수)
--   · transaction boundary: EscalationQueryable 패턴 (caller 의 client 받아 같이 commit/rollback)
--   · projector acceptance: 7일 dual-write 동안 divergence=0 이면 read source flip 검토
--   · write failure policy: best-effort, 원본 mutation 차단하지 않음
--
-- 이 마이그레이션은 *append-only* 이벤트 로그를 만들 뿐이며, 기존 bot_commitments
-- 의 read 경로는 건드리지 않는다. dual-write phase 동안에는 bot_commitments 가
-- SoT, commitment_events 는 audit/replay 용 redundant write.

BEGIN;

CREATE TABLE IF NOT EXISTS semo.commitment_events (
  event_id        BIGSERIAL PRIMARY KEY,
  commitment_id   TEXT      NOT NULL,
  event_type      TEXT      NOT NULL CHECK (event_type IN (
    'commitment_created', 'status_changed', 'heartbeat', 'step_done',
    'claimed', 'released', 'stale_reaped', 'cron_run_recorded'
  )),
  payload         JSONB     NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bot_id          TEXT,
  source_type     TEXT,
  runtime_source  TEXT,
  idempotency_key TEXT      NOT NULL,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_commitment_events_by_commitment_time
  ON semo.commitment_events (commitment_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_commitment_events_recent
  ON semo.commitment_events (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_commitment_events_by_bot_recent
  ON semo.commitment_events (bot_id, recorded_at DESC)
  WHERE bot_id IS NOT NULL;

COMMENT ON TABLE semo.commitment_events IS
  'Append-only event log for bot_commitments lifecycle (Ouroboros C5 dual-write phase, migration 119, 2026-05-06). '
  'During dual-write phase, bot_commitments remains read source. After 7+ days '
  'with zero replay divergences, read source flips to events table (separate PR). '
  'Write failures are logged but do not block the original mutation.';

COMMIT;
