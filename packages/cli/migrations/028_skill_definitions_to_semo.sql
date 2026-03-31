-- 028: skill_definitions를 semo 스키마로 이식 + KB skill 엔트리 제거
--
-- 목적: semo.skill_definitions를 유일한 SoT로 확립
-- 영향: CLI, 대시보드의 skill_definitions 참조를 semo 스키마로 전환
--       KB에서 skill 키 엔트리 완전 제거 (56 rows)

BEGIN;

-- 1. public → semo 스키마 이동 (atomic, 인덱스/제약조건 보존)
ALTER TABLE public.skill_definitions SET SCHEMA semo;

-- 2. KB skill 엔트리 삭제 (56 rows)
DELETE FROM semo.knowledge_base WHERE key = 'skill';

-- 3. kb_type_schema에서 skill 스킴 제거
DELETE FROM semo.kb_type_schema
WHERE type_key = 'organization' AND scheme_key = 'skill';

COMMIT;
