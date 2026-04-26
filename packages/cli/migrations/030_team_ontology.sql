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
-- 3. 팀원 ontology 도메인 — 인스턴스별 수동 등록
-- ============================================================
-- 이 migration 은 'team' (이후 'person' 으로 통합 — 081 참조) 타입 스키마만 등록한다.
-- 팀원 도메인 자체는 인스턴스별로 다르므로 `semo kb ontology --action register` 또는
-- `semo onto register <name> --type person` 으로 직접 등록할 것.
-- (이전 버전은 세미콜론 내부 팀원 10명 시드를 포함했으나 OSS 누출 방지를 위해 제거됨.)

COMMIT;
