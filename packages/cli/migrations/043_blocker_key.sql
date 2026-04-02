-- 043_blocker_key.sql
-- service 타입에 blocker collection 키 추가
-- 블로커 추적: 상태(active/resolved), 시작일, 해결일, 담당자, 출처
-- sub_key 패턴: blocker/{YYYY-MM-DD}/{slug}

INSERT INTO semo.kb_type_schema
  (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type)
VALUES
  ('service', 'blocker', '블로커 추적 (active/resolved 상태, 시작일/해결일 관리)',
   false,
   'blocker/{YYYY-MM-DD}/{slug}',
   200, 'collection')
ON CONFLICT (type_key, scheme_key) DO NOTHING;
