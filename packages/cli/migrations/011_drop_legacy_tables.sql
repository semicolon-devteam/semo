-- 011_drop_legacy_tables.sql
-- 레거시 정규화 테이블 정리: KB(domain='project')가 SoT로 확정됨
-- FK 의존관계 순서: 자식 → 부모

BEGIN;

-- Group A: 프로젝트 관리 계층 (KB domain='project'로 대체됨)
DROP TABLE IF EXISTS semo.kpi_snapshots;
DROP TABLE IF EXISTS semo.project_kpi;
DROP TABLE IF EXISTS semo.tasks;          -- FK: projects, epics, sprints
DROP TABLE IF EXISTS semo.sprints;        -- FK: projects
DROP TABLE IF EXISTS semo.epics;          -- FK: projects
DROP TABLE IF EXISTS semo.projects;       -- 루트 — KB가 SoT

-- Group B: 워크플로우 엔진 (생성만 되고 사용 안 됨)
DROP TABLE IF EXISTS semo.workflow_node_executions;  -- FK: instances, nodes
DROP TABLE IF EXISTS semo.workflow_instances;         -- FK: definitions, nodes
DROP TABLE IF EXISTS semo.workflow_nodes;             -- FK: definitions
DROP TABLE IF EXISTS semo.workflow_definitions;       -- 루트

-- Group C: 아카이브 코드에서만 참조 (mcp-server/_archived)
DROP TABLE IF EXISTS semo.sessions;
DROP TABLE IF EXISTS semo.interaction_logs;
DROP TABLE IF EXISTS semo.embedding_requests;
DROP TABLE IF EXISTS semo.user_facts;
DROP TABLE IF EXISTS semo.memory_stats;
DROP VIEW IF EXISTS semo.index_usage;
DROP TABLE IF EXISTS semo.audit_logs;

-- 마이그레이션 기록
INSERT INTO semo.schema_migrations (version)
VALUES ('011_drop_legacy_tables')
ON CONFLICT (version) DO NOTHING;

COMMIT;
