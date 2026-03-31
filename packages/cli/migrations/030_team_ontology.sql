-- 030_team_ontology.sql
-- team scheme_type 추가 + 팀원 10명 도메인 등록
-- 액션아이템 추적용 KB 구조 기반
--
-- 변경 내용:
--   1. ontology_types에 'team' 타입 추가
--   2. kb_type_schema에 team 타입 허용 키 등록 (action-item, profile, preference)
--   3. 팀원 10명 ontology 도메인 등록
--
-- 선행 조건: 022_kb_schema_enforcement.sql 적용 완료

BEGIN;

-- ============================================================
-- 1. team 엔티티 타입 등록
-- ============================================================

INSERT INTO semo.ontology_types (type_key, schema, description) VALUES
('team', '{
  "type": "object",
  "properties": {
    "content": {"type": "string"},
    "metadata": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "role": {"type": "string"},
        "slack_id": {"type": "string"}
      }
    }
  }
}', '팀원 개인 도메인 — 액션아이템, 프로필, 선호 등')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- 2. team 타입 허용 키 등록 (kb_type_schema)
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type)
VALUES
  ('team', 'action-item', '액션 아이템 추적',    false, 'action-item/current, action-item/2026-W13', 1, 'collection'),
  ('team', 'profile',     '팀원 프로필',         false, '역할, 연락처, 선호 등',                       2, 'singleton'),
  ('team', 'preference',  '팀원 업무 선호/스타일', false, '소통 선호, 업무 시간대 등',                    3, 'singleton')
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- ============================================================
-- 3. 팀원 10명 ontology 도메인 등록
-- ============================================================

INSERT INTO semo.ontology (domain, schema, entity_type, service, description, tags) VALUES
  ('reus',   '{}', 'team', '_global', '전준영 — 프론트 리드 엔지니어 / 협업 매니저', ARRAY['team', 'leader']),
  ('garden', '{}', 'team', '_global', '서정원 — 시스템 아키텍처 / 기술 통합 리드',   ARRAY['team', 'architect']),
  ('roki',   '{}', 'team', '_global', '노영록 — 서비스총괄 / 그로스 디렉터',         ARRAY['team', 'growth']),
  ('yeomso', '{}', 'team', '_global', '염준현 — 디자인총괄 / CMO',                  ARRAY['team', 'design']),
  ('bon',    '{}', 'team', '_global', 'bon — 리드급 프론트엔드 엔지니어',            ARRAY['team', 'frontend']),
  ('kyago',  '{}', 'team', '_global', '강용준 — 백엔드 리더',                       ARRAY['team', 'backend']),
  ('bae',    '{}', 'team', '_global', 'Bae — 인프라/백엔드 엔지니어',               ARRAY['team', 'infra']),
  ('harry',  '{}', 'team', '_global', 'Harry Lee — 시니어 프론트엔드 엔지니어',      ARRAY['team', 'frontend']),
  ('goni',   '{}', 'team', '_global', 'Goni — 서비스 운영 / QA',                   ARRAY['team', 'ops']),
  ('kai',    '{}', 'team', '_global', 'Kai — 견습 엔지니어',                        ARRAY['team', 'junior'])
ON CONFLICT (domain) DO NOTHING;

COMMIT;
