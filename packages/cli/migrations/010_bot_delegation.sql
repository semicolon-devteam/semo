-- 010_bot_delegation.sql
-- Bot delegation matrix: who can delegate what to whom

CREATE TABLE IF NOT EXISTS semo.bot_delegation (
  id SERIAL PRIMARY KEY,
  from_bot_id TEXT NOT NULL,
  to_bot_id TEXT NOT NULL,
  delegation_type TEXT NOT NULL DEFAULT 'task',
  domains TEXT[] NOT NULL DEFAULT '{}',
  method TEXT NOT NULL DEFAULT 'github_issue',
  channel TEXT,
  max_roundtrips INT DEFAULT 5,
  priority TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_bot_id, to_bot_id, delegation_type)
);

-- Protocol metadata (structured version of PROTOCOL.md)
CREATE TABLE IF NOT EXISTS semo.bot_protocol (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
