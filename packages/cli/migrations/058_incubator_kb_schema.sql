-- 058: Add incubator-status key to service type schema
-- Allows semo kb upsert {service} incubator-status for tracking incubator checkpoints

INSERT INTO semo.kb_type_schema
  (type_key, scheme_key, scheme_description, required, key_type, source)
VALUES
  ('service', 'incubator-status', '인큐베이터 진행 상태 (CP, 담당봇, 마지막 활동)', false, 'singleton', 'manual')
ON CONFLICT (type_key, scheme_key) DO NOTHING;
