-- 019_test_management.sql
-- SEMO 테스트 관리 시스템: 스위트 레지스트리 + 실행 이력 + TC 결과 추적

BEGIN;

-- 1. test_suites: 테스트 스위트 레지스트리
CREATE TABLE IF NOT EXISTS semo.test_suites (
  suite_id      TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  layer         TEXT NOT NULL DEFAULT 'integration',
  runner_type   TEXT NOT NULL DEFAULT 'tsx',
  runner_path   TEXT NOT NULL,
  schedule      TEXT,
  enabled       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. test_cases: 개별 TC 정의 (첫 실행 시 자동 등록)
CREATE TABLE IF NOT EXISTS semo.test_cases (
  case_id       TEXT NOT NULL,
  suite_id      TEXT NOT NULL REFERENCES semo.test_suites(suite_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT,
  severity      TEXT DEFAULT 'normal',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (suite_id, case_id)
);

-- 3. test_runs: 실행 이력
CREATE TABLE IF NOT EXISTS semo.test_runs (
  run_id        TEXT PRIMARY KEY,
  suite_id      TEXT NOT NULL REFERENCES semo.test_suites(suite_id) ON DELETE CASCADE,
  triggered_by  TEXT NOT NULL DEFAULT 'manual',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  total_pass    INT DEFAULT 0,
  total_fail    INT DEFAULT 0,
  total_warn    INT DEFAULT 0,
  status        TEXT DEFAULT 'running',
  summary       TEXT
);

-- 4. test_results: 개별 TC 결과
CREATE TABLE IF NOT EXISTS semo.test_results (
  id            BIGSERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES semo.test_runs(run_id) ON DELETE CASCADE,
  case_id       TEXT NOT NULL,
  suite_id      TEXT NOT NULL,
  label         TEXT NOT NULL,
  status        TEXT NOT NULL,
  detail        TEXT,
  duration_ms   INT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON semo.test_runs(suite_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_run ON semo.test_results(run_id);

-- Seed: 기존 4개 테스트 스위트 등록
INSERT INTO semo.test_suites (suite_id, name, layer, runner_type, runner_path) VALUES
  ('017-migration',      '017 Migration Validation',  'integration', 'tsx',   'packages/mcp-kb/test-017-migration.ts'),
  ('018-transplant',     '018 Data Transplant',       'integration', 'tsx',   'packages/mcp-kb/test-018-data-transplant.ts'),
  ('018-ai-integration', '018 AI Integration E2E',    'e2e',         'tsx',   'packages/mcp-kb/test-018-ai-integration.ts'),
  ('workspace-audit',    'Bot Workspace Compliance',  'compliance',  'shell', '~/.openclaw-shared/workspace-audit/run-audit.sh')
ON CONFLICT (suite_id) DO NOTHING;

COMMIT;
