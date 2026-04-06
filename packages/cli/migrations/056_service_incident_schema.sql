-- 056_service_incident_schema.sql
-- service 타입에 incident (인시던트/장애) collection 키 추가
-- organization 타입에는 이미 incident가 등록되어 있으나 service 타입에는 누락

BEGIN;

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type)
VALUES
  ('service', 'incident', '인시던트/장애 기록', false,
   '서브키: 슬러그. metadata: occurred_at(날짜), severity(p0-p3), status(active/resolved), resolved_at, root_cause',
   50, 'collection')
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  scheme_description = EXCLUDED.scheme_description,
  value_hint = EXCLUDED.value_hint;

COMMIT;
