-- SEMO KB/Ontology Schema
-- Phase 1: Core tables for Knowledge Base and Ontology management

-- Ensure semo schema exists
CREATE SCHEMA IF NOT EXISTS semo;

-- Enable pgvector if not already
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. 공통 KB (팀 전체 공유 지식)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.knowledge_base (
    kb_id BIGSERIAL PRIMARY KEY,
    domain VARCHAR(100) NOT NULL,          -- 'team', 'project', 'infra', 'process', 'decision'
    key VARCHAR(255) NOT NULL,             -- unique identifier within domain
    content TEXT NOT NULL,                 -- actual knowledge content
    embedding vector(1536),               -- OpenAI text-embedding-3-small
    metadata JSONB DEFAULT '{}',          -- tags, source, etc.
    version INT DEFAULT 1,
    created_by VARCHAR(50),               -- 'semiclaw', 'workclaw', 'reus', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(domain, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_domain ON semo.knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_kb_created_by ON semo.knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_kb_updated_at ON semo.knowledge_base(updated_at DESC);

-- HNSW index for vector search (create after data exists, or with small initial size)
-- CREATE INDEX IF NOT EXISTS idx_kb_embedding ON semo.knowledge_base
--     USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 2. 봇별 KB (봇 고유 지식)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.bot_knowledge (
    id BIGSERIAL PRIMARY KEY,
    bot_id VARCHAR(50) NOT NULL,           -- 'semiclaw', 'workclaw', 'planclaw', etc.
    domain VARCHAR(100) NOT NULL,
    key VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    version INT DEFAULT 1,
    synced_at TIMESTAMPTZ,                 -- last sync timestamp for this entry
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bot_id, domain, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_botk_bot_id ON semo.bot_knowledge(bot_id);
CREATE INDEX IF NOT EXISTS idx_botk_domain ON semo.bot_knowledge(bot_id, domain);
CREATE INDEX IF NOT EXISTS idx_botk_updated_at ON semo.bot_knowledge(updated_at DESC);

-- ============================================================
-- 3. 온톨로지 정의 (도메인 스키마)
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.ontology (
    id BIGSERIAL PRIMARY KEY,
    domain VARCHAR(100) NOT NULL UNIQUE,
    schema JSONB NOT NULL,                 -- JSON Schema for domain entries
    description TEXT,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Helper: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION semo.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
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
-- 5. Seed: Default ontology domains
-- ============================================================
INSERT INTO semo.ontology (domain, schema, description) VALUES
('team', '{
    "type": "object",
    "required": ["key", "content"],
    "properties": {
        "key": { "type": "string", "description": "팀원 이름 또는 역할" },
        "content": { "type": "string", "description": "역할, 스킬, 연락처 등" },
        "metadata": {
            "type": "object",
            "properties": {
                "role": { "type": "string" },
                "skills": { "type": "array", "items": { "type": "string" } }
            }
        }
    }
}', '팀원 정보, R&R, 스킬셋'),
('project', '{
    "type": "object",
    "required": ["key", "content"],
    "properties": {
        "key": { "type": "string", "description": "프로젝트명" },
        "content": { "type": "string", "description": "프로젝트 설명, 현황" },
        "metadata": {
            "type": "object",
            "properties": {
                "status": { "enum": ["active", "paused", "completed", "planned"] },
                "stack": { "type": "array", "items": { "type": "string" } },
                "owner": { "type": "string" }
            }
        }
    }
}', '프로젝트 정보, 현황, 기술 스택'),
('decision', '{
    "type": "object",
    "required": ["key", "content"],
    "properties": {
        "key": { "type": "string", "description": "결정 제목" },
        "content": { "type": "string", "description": "결정 내용, 배경, 근거" },
        "metadata": {
            "type": "object",
            "properties": {
                "decided_by": { "type": "string" },
                "decided_at": { "type": "string", "format": "date" },
                "scope": { "enum": ["team", "project", "bot", "infra"] }
            }
        }
    }
}', '의사결정 기록'),
('process', '{
    "type": "object",
    "required": ["key", "content"],
    "properties": {
        "key": { "type": "string", "description": "프로세스명" },
        "content": { "type": "string", "description": "프로세스 설명, 단계" },
        "metadata": {
            "type": "object",
            "properties": {
                "type": { "enum": ["workflow", "rule", "guideline", "checklist"] },
                "applies_to": { "type": "array", "items": { "type": "string" } }
            }
        }
    }
}', '업무 프로세스, 규칙, 가이드라인'),
('infra', '{
    "type": "object",
    "required": ["key", "content"],
    "properties": {
        "key": { "type": "string", "description": "인프라 리소스명" },
        "content": { "type": "string", "description": "설정, 접근 방법, 구조" },
        "metadata": {
            "type": "object",
            "properties": {
                "type": { "enum": ["server", "database", "service", "ci-cd", "monitoring"] },
                "environment": { "enum": ["production", "staging", "development"] }
            }
        }
    }
}', '인프라 구성, 서버, DB, CI/CD')
ON CONFLICT (domain) DO NOTHING;
