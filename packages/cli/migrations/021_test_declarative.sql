-- 021_test_declarative.sql
-- test_suites에 rule_source 컬럼 추가 + workspace-audit을 declarative 타입으로 전환

BEGIN;

-- runner_path를 nullable로 변경 (declarative는 path 불필요)
ALTER TABLE semo.test_suites ALTER COLUMN runner_path DROP NOT NULL;

-- rule_source: declarative 러너가 규칙을 로드할 테이블명
ALTER TABLE semo.test_suites ADD COLUMN IF NOT EXISTS rule_source TEXT;

-- workspace-audit을 declarative로 전환
UPDATE semo.test_suites
SET runner_type = 'declarative',
    runner_path = NULL,
    rule_source = 'bot_workspace_standard'
WHERE suite_id = 'workspace-audit';

COMMIT;
