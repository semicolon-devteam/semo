-- 130_colony_dreaming_memory_cycle.sql
-- Colony Dreaming Memory Cycle:
-- Slack 3h collection -> Hermes reflection -> KB promotion.

ALTER TABLE semo.bot_cron_jobs
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS runtime_source TEXT;

CREATE TABLE IF NOT EXISTS semo.colony_memory_runs (
  run_id        TEXT PRIMARY KEY,
  status        TEXT NOT NULL,
  window_id     TEXT NOT NULL,
  window_from   TIMESTAMPTZ NOT NULL,
  window_to     TIMESTAMPTZ NOT NULL,
  channel_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  write_count   INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_colony_memory_runs_window
  ON semo.colony_memory_runs(window_to DESC, status);

CREATE TABLE IF NOT EXISTS semo.colony_memory_candidates (
  candidate_id      TEXT PRIMARY KEY,
  domain            TEXT NOT NULL,
  key               TEXT NOT NULL,
  sub_key           TEXT NOT NULL,
  content           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','auto_promoted','approved','rejected','retired')),
  confidence        NUMERIC,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  source_refs       JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colony_memory_candidates_status
  ON semo.colony_memory_candidates(status, requires_approval, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_colony_memory_candidates_domain
  ON semo.colony_memory_candidates(domain, key, sub_key);

COMMENT ON TABLE semo.colony_memory_runs IS
  'Audit log for Colony Dreaming Memory Cycle executions.';

COMMENT ON TABLE semo.colony_memory_candidates IS
  'Structured memory candidates extracted by Colony/Hermes before or during KB promotion.';

INSERT INTO semo.bot_cron_jobs
  (bot_id, job_id, name, schedule, enabled, session_target, payload, runtime_source, synced_at)
VALUES
  (
    'colony',
    'colony-memory-cycle-3h',
    'Colony Dreaming Memory Cycle (3h)',
    '{"kind":"cron","expr":"0 */3 * * *"}'::jsonb,
    TRUE,
    'isolated',
    jsonb_build_object(
      'kind', 'agentTurn',
      'message',
      'Run the Colony Dreaming Memory Cycle. Execute `semo colony memory-cycle --window-hours 3 --profile semo-colony`, inspect the output, then complete this cron run with semo cron mark-run. If Slack/Hermes/KB fails, mark failure with the concise error.',
      'report_channel', '#bot-ops',
      'target_domain', 'semicolony',
      'max_duration', 1800
    ),
    'cron',
    NOW()
  )
ON CONFLICT (bot_id, job_id) DO UPDATE SET
  name = EXCLUDED.name,
  schedule = EXCLUDED.schedule,
  enabled = EXCLUDED.enabled,
  session_target = EXCLUDED.session_target,
  payload = EXCLUDED.payload,
  runtime_source = EXCLUDED.runtime_source,
  synced_at = NOW();
