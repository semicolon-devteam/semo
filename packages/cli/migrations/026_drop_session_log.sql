BEGIN;

-- 1. kb_type_schema에서 session-log 행 제거
DELETE FROM semo.kb_type_schema
WHERE type_key = 'organization' AND scheme_key = 'session-log';

-- 2. ontology_types에서 session-log 타입 제거 (있다면)
DELETE FROM semo.ontology_types WHERE type_key = 'session-log';

-- 3. 기존 session-log 데이터 정리
DELETE FROM semo.knowledge_base
WHERE domain = 'semicolon' AND key = 'session-log';

-- 4. semicolon 온톨로지 description에서 session-log 참조 제거
UPDATE semo.ontology
SET description = REPLACE(description, '/session-log', '')
WHERE domain = 'semicolon' AND description LIKE '%session-log%';

COMMIT;
