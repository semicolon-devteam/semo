-- 068: 인큐베이터 KB 데이터를 semo-incubator 모듈 도메인으로 이동
-- 의존: 067_module_ontology_type.sql (semo-incubator 도메인 등록)

BEGIN;

-- 1. semo/project/semo-incubator → semo-incubator/base-information
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
SELECT 'semo-incubator', 'base-information', '', content, metadata, 'migration-068', embedding
FROM semo.knowledge_base
WHERE domain = 'semo' AND key = 'project' AND sub_key = 'semo-incubator'
ON CONFLICT (domain, key, sub_key) DO UPDATE
  SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding;

-- 2. semo/reference/incubator-sandbox → semo-incubator/reference/sandbox
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by, embedding)
SELECT 'semo-incubator', 'reference', 'sandbox', content, metadata, 'migration-068', embedding
FROM semo.knowledge_base
WHERE domain = 'semo' AND key = 'reference' AND sub_key = 'incubator-sandbox'
ON CONFLICT (domain, key, sub_key) DO UPDATE
  SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding;

-- 3. 원본 삭제
DELETE FROM semo.knowledge_base
WHERE domain = 'semo' AND key = 'project' AND sub_key = 'semo-incubator';

DELETE FROM semo.knowledge_base
WHERE domain = 'semo' AND key = 'reference' AND sub_key = 'incubator-sandbox';

-- glossary(semicolon/glossary/semo-incubator), decision(semicolon/decision/semo-incubator-naming)은
-- 조직 레벨 지식이므로 semicolon에 유지

COMMIT;
