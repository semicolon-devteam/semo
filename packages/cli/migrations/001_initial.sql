-- 001_initial.sql
-- 기존 semo 스키마 문서화 (모든 테이블은 이미 존재)
-- IF NOT EXISTS로 안전하게 작성 — 새 환경에서도 적용 가능

CREATE SCHEMA IF NOT EXISTS semo;

-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. skills
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,
  content TEXT NOT NULL,
  category VARCHAR(50),
  package VARCHAR(50) DEFAULT 'core',
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  install_order INT DEFAULT 100,
  version VARCHAR(20) DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. commands
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  folder VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(folder, name)
);

-- ============================================================
-- 3. agents
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  content TEXT NOT NULL,
  package VARCHAR(50) DEFAULT 'core',
  is_active BOOLEAN DEFAULT true,
  install_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. packages
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,
  layer VARCHAR(50),
  package_type VARCHAR(50),
  version VARCHAR(20) DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  install_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. knowledge_base (공통 KB)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.knowledge_base (
  kb_id BIGSERIAL PRIMARY KEY,
  domain VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  created_by VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, key)
);

-- ============================================================
-- 6. bot_knowledge (봇별 KB)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_knowledge (
  id BIGSERIAL PRIMARY KEY,
  bot_id VARCHAR(50) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, domain, key)
);

-- ============================================================
-- 7. ontology (도메인 스키마)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.ontology (
  id BIGSERIAL PRIMARY KEY,
  domain VARCHAR(100) NOT NULL UNIQUE,
  schema JSONB NOT NULL,
  description TEXT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. bot_status
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_status (
  bot_id TEXT PRIMARY KEY,
  name TEXT,
  emoji TEXT,
  role TEXT,
  last_active TIMESTAMP,
  session_count INTEGER DEFAULT 0,
  workspace_path TEXT,
  status TEXT,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 9. bot_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_sessions (
  bot_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  label TEXT,
  kind TEXT,
  chat_type TEXT,
  last_activity TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, session_key)
);

-- ============================================================
-- 10. bot_cron_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_cron_jobs (
  bot_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  name TEXT,
  schedule JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  session_target TEXT,
  synced_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (bot_id, job_id)
);

-- ============================================================
-- 11. bot_query_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_query_logs (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  channel TEXT,
  channel_id TEXT,
  thread_id TEXT,
  query TEXT NOT NULL,
  response TEXT,
  model TEXT,
  latency_ms INTEGER,
  token_input INTEGER,
  token_output INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 기존 인덱스 (이미 존재하면 skip)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_semo_skills_name ON semo.skills(name);
CREATE INDEX IF NOT EXISTS idx_semo_skills_active ON semo.skills(is_active);
CREATE INDEX IF NOT EXISTS idx_semo_skills_category ON semo.skills(category);
CREATE INDEX IF NOT EXISTS idx_semo_commands_folder ON semo.commands(folder);
CREATE INDEX IF NOT EXISTS idx_semo_commands_active ON semo.commands(is_active);
CREATE INDEX IF NOT EXISTS idx_semo_agents_name ON semo.agents(name);
CREATE INDEX IF NOT EXISTS idx_semo_agents_active ON semo.agents(is_active);
CREATE INDEX IF NOT EXISTS idx_semo_packages_name ON semo.packages(name);
CREATE INDEX IF NOT EXISTS idx_semo_packages_layer ON semo.packages(layer);
CREATE INDEX IF NOT EXISTS idx_semo_packages_active ON semo.packages(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_domain ON semo.knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_kb_created_by ON semo.knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_kb_updated_at ON semo.knowledge_base(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_embedding ON semo.knowledge_base USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_botk_bot_id ON semo.bot_knowledge(bot_id);
CREATE INDEX IF NOT EXISTS idx_botk_domain ON semo.bot_knowledge(bot_id, domain);
CREATE INDEX IF NOT EXISTS idx_botk_updated_at ON semo.bot_knowledge(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_botk_embedding ON semo.bot_knowledge USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_bot_status_synced_at ON semo.bot_status(synced_at);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_bot_id ON semo.bot_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_last_activity ON semo.bot_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_bot_cron_jobs_bot_id ON semo.bot_cron_jobs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_cron_jobs_next_run ON semo.bot_cron_jobs(next_run);

-- ============================================================
-- Helper: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION semo.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kb_updated_at') THEN
        CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON semo.knowledge_base
            FOR EACH ROW EXECUTE FUNCTION semo.update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_botk_updated_at') THEN
        CREATE TRIGGER trg_botk_updated_at BEFORE UPDATE ON semo.bot_knowledge
            FOR EACH ROW EXECUTE FUNCTION semo.update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_onto_updated_at') THEN
        CREATE TRIGGER trg_onto_updated_at BEFORE UPDATE ON semo.ontology
            FOR EACH ROW EXECUTE FUNCTION semo.update_updated_at();
    END IF;
END $$;

-- ============================================================
-- Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION semo.get_active_skills()
RETURNS TABLE (
  name VARCHAR(100),
  content TEXT,
  category VARCHAR(50),
  install_order INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.name, s.content, s.category, s.install_order
  FROM semo.skills s
  WHERE s.is_active = true
  ORDER BY s.install_order;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION semo.get_skill_count_by_category()
RETURNS TABLE (
  category VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.category, COUNT(*)::BIGINT
  FROM semo.skills s
  WHERE s.is_active = true
  GROUP BY s.category
  ORDER BY MIN(s.install_order);
END;
$$ LANGUAGE plpgsql;
