-- 025: KB Flat Key Migration
-- key + sub_key 분리: key는 scheme_key exact match, sub_key는 계층 식별자
BEGIN;

-- 1. sub_key 컬럼 추가
ALTER TABLE semo.knowledge_base
  ADD COLUMN IF NOT EXISTS sub_key VARCHAR(255) NOT NULL DEFAULT '';

-- 2. 기존 Unique constraint 제거 (UPDATE 전에 제거해야 충돌 없음)
ALTER TABLE semo.knowledge_base
  DROP CONSTRAINT IF EXISTS knowledge_base_domain_key_key;

-- 3. 기존 collection 키 분리 (첫 '/' 기준)
UPDATE semo.knowledge_base
SET sub_key = SUBSTRING(key FROM POSITION('/' IN key) + 1),
    key     = SPLIT_PART(key, '/', 1)
WHERE key LIKE '%/%';

-- 4. 새 Unique constraint 추가
ALTER TABLE semo.knowledge_base
  ADD CONSTRAINT knowledge_base_domain_key_subkey_key
    UNIQUE (domain, key, sub_key);

-- 5. 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_kb_domain_key ON semo.knowledge_base (domain, key);

-- 6. 테스트 파이프라인 등록
INSERT INTO semo.test_suites (suite_id, name, layer, runner_type, runner_path, enabled)
VALUES ('025-flat-keys', '025 KB Flat Key Migration', 'integration', 'tsx',
        'packages/mcp-kb/test-025-flat-keys.ts', true)
ON CONFLICT (suite_id) DO NOTHING;

COMMIT;
