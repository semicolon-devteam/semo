-- 074_schema_ref_type.sql
-- kb_type_schema에 ref_type 컬럼 추가
-- 특정 키의 값이 다른 온톨로지 도메인을 참조해야 할 때, 참조 대상 타입을 지정
-- upsert 시 content가 해당 타입의 등록된 도메인인지 자동 검증

-- 1. ref_type 컬럼 추가
ALTER TABLE semo.kb_type_schema
  ADD COLUMN IF NOT EXISTS ref_type VARCHAR(100)
    REFERENCES semo.ontology_types(type_key);

COMMENT ON COLUMN semo.kb_type_schema.ref_type IS
  '값이 참조해야 하는 온톨로지 타입. 설정 시 content가 해당 타입의 도메인으로 존재하는지 upsert 시 검증.';

-- 2. person.organization은 하이브리드 허용 (도메인명 우선, 자유 텍스트 폴백)
-- ref_type 강제 검증을 걸지 않고 value_hint로만 가이드한다.
-- ref_type이 필요한 키가 생기면 여기에 UPDATE 추가.
