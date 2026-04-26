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
  value_hint = 'role/overall, role/{project-domain} 등 프로젝트별 역할'
WHERE type_key = 'person' AND scheme_key = 'role';

-- 3. ontology: team → person 타입 변경
UPDATE semo.ontology SET entity_type = 'person' WHERE entity_type = 'team';

-- 4. 기존 person 도메인에 organization 키 placeholder 삽입 (인스턴스별 수동 채움)
-- 세미콜론 내부 backfill 은 이 migration 이 처음 적용된 시점에 한해 효력 발휘.
-- OSS fresh install: 이 시점에 person 도메인 자체가 0건이므로 no-op.
-- (이전 버전은 세미콜론 팀원 13명 닉네임을 IN 절에 포함했으나 누출 방지를 위해 제거됨.)
-- organization 키 값은 인스턴스가 직접 채워야 한다 — 자동 시드하지 않음.

-- 5. team 타입 스키마 제거
DELETE FROM semo.kb_type_schema WHERE type_key = 'team';

-- 6. ontology_types에서 team 제거
DELETE FROM semo.ontology_types WHERE type_key = 'team';

COMMIT;
