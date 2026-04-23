import type Database from 'better-sqlite3';

export const OPS_DDL = `
CREATE TABLE IF NOT EXISTS bot_commitments (
  id               TEXT PRIMARY KEY,
  bot_id           TEXT NOT NULL,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active',
  source_type      TEXT NOT NULL,
  session_owner    TEXT,
  pipeline_context TEXT,
  metadata         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bc_bot        ON bot_commitments(bot_id);
CREATE INDEX IF NOT EXISTS idx_bc_status     ON bot_commitments(status);
CREATE INDEX IF NOT EXISTS idx_bc_updated_at ON bot_commitments(updated_at);

CREATE TABLE IF NOT EXISTS bot_cron_jobs (
  bot_id          TEXT NOT NULL,
  job_id          TEXT NOT NULL,
  name            TEXT,
  schedule        TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_run        TEXT,
  next_run        TEXT,
  session_target  TEXT,
  payload         TEXT,
  synced_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (bot_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_cron_next_run ON bot_cron_jobs(next_run);

CREATE TABLE IF NOT EXISTS bot_seats (
  seat_id            TEXT PRIMARY KEY,
  claude_config_dir  TEXT NOT NULL,
  max_concurrent     INTEGER NOT NULL DEFAULT 1,
  current_bot_id     TEXT,
  allocated_at       TEXT,
  status             TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','allocated','quarantined')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seats_status ON bot_seats(status);
`;

export function applyOpsSchema(db: Database.Database): void {
  db.exec(OPS_DDL);
}
