-- SEMO Sync Agent Database Schema
-- PostgreSQL Schema for bot status synchronization

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS semo;

-- Bot status table (aggregate per bot)
CREATE TABLE IF NOT EXISTS semo.bot_status (
  bot_id TEXT PRIMARY KEY,
  name TEXT,
  emoji TEXT,
  role TEXT,
  last_active TIMESTAMP,
  session_count INTEGER DEFAULT 0,
  workspace_path TEXT,
  status TEXT, -- 'active' | 'idle' | 'error'
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Bot sessions table (detailed session info)
CREATE TABLE IF NOT EXISTS semo.bot_sessions (
  bot_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  label TEXT,
  kind TEXT, -- 'main' | 'isolated'
  chat_type TEXT, -- 'slack' | 'telegram' | ...
  last_activity TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, session_key)
);

-- Bot cron jobs table
CREATE TABLE IF NOT EXISTS semo.bot_cron_jobs (
  bot_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  name TEXT,
  schedule JSONB, -- Full schedule structure (kind, expr, everyMs, etc.)
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  session_target TEXT, -- 'main' | 'isolated'
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, job_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_status_synced_at ON semo.bot_status(synced_at);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_bot_id ON semo.bot_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_last_activity ON semo.bot_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_bot_cron_jobs_bot_id ON semo.bot_cron_jobs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_cron_jobs_next_run ON semo.bot_cron_jobs(next_run);

-- Grant permissions (adjust user as needed)
-- GRANT ALL PRIVILEGES ON SCHEMA semo TO app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA semo TO app;

-- Comments
COMMENT ON TABLE semo.bot_status IS 'Aggregate bot status (one row per bot)';
COMMENT ON TABLE semo.bot_sessions IS 'Detailed session information per bot';
COMMENT ON TABLE semo.bot_cron_jobs IS 'Cron job configuration and status per bot';
