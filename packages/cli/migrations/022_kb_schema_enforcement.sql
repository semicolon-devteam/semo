-- 022_kb_schema_enforcement.sql
-- KB 키 검증 강화: scheme_key 1뎁스 전환 + key_type 컬럼 추가
--
-- 변경 내용:
--   1. key_type 컬럼 추가 (singleton | collection)
--   2. 기존 변수 패턴({...}) scheme_key → collection으로 마킹
--   3. scheme_key를 1뎁스(첫 세그먼트)로 축약
--   4. 축약 후 중복 제거
--   5. service 타입에 kpi/milestone collection 추가
--
-- 선행 조건: 018_type_schema.sql 적용 완료

BEGIN;

-- ============================================================
-- 1. key_type 컬럼 추가
-- ============================================================

ALTER TABLE semo.kb_type_schema
  ADD COLUMN IF NOT EXISTS key_type VARCHAR(20) DEFAULT 'singleton';

-- ============================================================
-- 2. 기존 데이터 key_type 설정 (변수 포함 = collection)
-- ============================================================

UPDATE semo.kb_type_schema
SET key_type = 'collection'
WHERE scheme_key LIKE '%{%';

-- ============================================================
-- 3. scheme_key를 1뎁스로 축약 (첫 번째 세그먼트만)
-- ============================================================

UPDATE semo.kb_type_schema
SET scheme_key = SPLIT_PART(scheme_key, '/', 1)
WHERE scheme_key LIKE '%/%';

-- ============================================================
-- 4. 중복 제거 (축약 후 동일 type_key+scheme_key 병합)
-- ============================================================

DELETE FROM semo.kb_type_schema a
USING semo.kb_type_schema b
WHERE a.id > b.id
  AND a.type_key = b.type_key
  AND a.scheme_key = b.scheme_key;

-- 축약 후 collection으로 마킹되지 않은 행도 올바르게 설정
-- (예: 'team' 은 원래 'team/{name}'이었으므로 collection)
UPDATE semo.kb_type_schema
SET key_type = 'collection'
WHERE key_type = 'singleton'
  AND scheme_key IN ('team', 'decision', 'process', 'infra', 'bot-config', 'skill', 'spec', 'memory', 'session-log');

-- kpi 타입의 '{YYYY-WNN}' → collection으로 이미 변환됨, 축약 후 '{YYYY-WNN}' 자체가 첫 세그먼트
-- 이 잔여 항목 정리 (변수 패턴이 첫 세그먼트인 경우 삭제 — collection prefix로 대체 불가)
DELETE FROM semo.kb_type_schema
WHERE scheme_key LIKE '{%';

-- milestone 타입의 '{slug}' 도 동일하게 삭제
-- (service.milestone collection으로 통합)

-- ============================================================
-- 5. service 타입에 kpi/milestone collection 추가
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type)
VALUES
  ('service', 'kpi',       'KPI (current/target/주간 스냅샷)', false, 'kpi/current, kpi/target, kpi/2026-W12', 10, 'collection'),
  ('service', 'milestone', '마일스톤 항목',                    false, 'milestone/blog-auto-gen',                11, 'collection')
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  key_type = 'collection',
  scheme_description = EXCLUDED.scheme_description,
  value_hint = EXCLUDED.value_hint,
  sort_order = EXCLUDED.sort_order;

COMMIT;
