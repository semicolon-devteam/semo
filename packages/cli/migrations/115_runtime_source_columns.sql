-- 115_runtime_source_columns.sql
-- 2026-05-06: OpenClaw + slack-router 공존 운영 — runtime_source 메타 추가.
-- Codex review (semicolon-plan-review): "두 운영 루프가 commitments/cron 공유 시
-- source 구분 필수. 최소값: slack-router | openclaw | manual | cron"
--
-- 모든 컬럼 nullable — 회귀 0. 기존 row 는 source_type 기반 추론 backfill.

-- ── bot_commitments ──
ALTER TABLE semo.bot_commitments
  ADD COLUMN IF NOT EXISTS runtime_source TEXT;

COMMENT ON COLUMN semo.bot_commitments.runtime_source IS
  '운영 런타임 출처. slack-router | openclaw | manual | cron. 2026-05-06 추가 (KB semo decision/openclaw-architecture-b-coexist).';

-- backfill: source_type → runtime_source 추론
UPDATE semo.bot_commitments
SET runtime_source = CASE
  WHEN source_type = 'slack-inbox' THEN 'slack-router'
  WHEN source_type = 'cron' THEN 'cron'
  WHEN source_type = 'claude-code-local' THEN 'manual'
  WHEN source_type LIKE 'openclaw%' THEN 'openclaw'
  ELSE NULL
END
WHERE runtime_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_commitments_runtime_source
  ON semo.bot_commitments (runtime_source)
  WHERE runtime_source IS NOT NULL;

-- ── bot_cron_jobs ──
ALTER TABLE semo.bot_cron_jobs
  ADD COLUMN IF NOT EXISTS runtime_source TEXT;

COMMENT ON COLUMN semo.bot_cron_jobs.runtime_source IS
  '잡을 fire 하는 런타임. cron(=cron-poller, Architecture B) | openclaw(=OpenClaw 자체 cron) | manual.';

-- 기본 backfill: 기존 cron 잡은 cron-poller 가 fan-out 하던 것이므로 'cron'
UPDATE semo.bot_cron_jobs
SET runtime_source = 'cron'
WHERE runtime_source IS NULL;

-- ── action_items ──
ALTER TABLE semo.action_items
  ADD COLUMN IF NOT EXISTS runtime_source TEXT;

COMMENT ON COLUMN semo.action_items.runtime_source IS
  '액션 아이템 생성 런타임. slack-router | openclaw | manual | cron.';

-- 기본 backfill: 기존 action_item 은 사용자 직접 / 봇이 만든 것이라 'manual'
UPDATE semo.action_items
SET runtime_source = 'manual'
WHERE runtime_source IS NULL;
