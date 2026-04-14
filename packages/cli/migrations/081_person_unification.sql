-- 076_person_unification.sql
-- team 타입과 person 타입을 person으로 통합

BEGIN;

-- 1. person 스키마에 team 전용 키 추가
INSERT INTO semo.kb_type_schema (type_key, scheme_key, key_type, required, scheme_description, value_hint)
VALUES
  ('person', 'nickname', 'singleton', false, '닉네임', '팀 내 닉네임'),
  ('person', 'slack-id', 'singleton', false, 'Slack ID', 'Slack User ID (e.g. URSQYUNQJ)'),
  ('person', 'discord-id', 'singleton', false, 'Discord ID', 'Discord User ID (snowflake)'),
  ('person', 'tech-stack', 'singleton', false, '기술스택', '주요 기술/언어/프레임워크'),
  ('person', 'career', 'singleton', false, '경력', '이전 회사, 경력 요약'),
  ('person', 'compensation', 'singleton', false, 'compensation', '보상 구조'),
  ('person', 'dm-channel', 'singleton', false, 'dm-channel', 'Slack DM channel ID'),
  ('person', 'communication-profile', 'singleton', false,
   '봇 커뮤니케이션 프로필 — 기술수준, 접근권한, 톤 지시',
   'YAML: tech_level, access_level, dri_scope, comm_style, language')
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- 2. person의 role을 collection으로 변경
UPDATE semo.kb_type_schema SET key_type = 'collection',
  value_hint = 'role/overall, role/feel-free 등 프로젝트별 역할'
WHERE type_key = 'person' AND scheme_key = 'role';

-- 3. ontology: team → person 타입 변경
UPDATE semo.ontology SET entity_type = 'person' WHERE entity_type = 'team';

-- 4. 기존 내부 팀원에 organization='semicolon' 자동 삽입
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, created_by)
SELECT o.domain, 'organization', '', 'semicolon', 'migration-076'
FROM semo.ontology o
WHERE o.entity_type = 'person'
  AND o.domain IN ('reus','garden','roki','bon','goni','harry','kai','kevin','kibaek','kyago','mark','bae','yeomso')
  AND NOT EXISTS (
    SELECT 1 FROM semo.knowledge_base kb
    WHERE kb.domain = o.domain AND kb.key = 'organization'
  );

-- 5. team 타입 스키마 제거
DELETE FROM semo.kb_type_schema WHERE type_key = 'team';

-- 6. ontology_types에서 team 제거
DELETE FROM semo.ontology_types WHERE type_key = 'team';

COMMIT;
