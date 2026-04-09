-- 067: module 온톨로지 타입 도입
-- 플랫폼(semo) 하위 서브시스템(incubator, voice, meeting, agents 등)을 위한 전용 타입.
-- parent 컬럼 활성화로 계층 구조 지원.

BEGIN;

-- 1. module 타입 등록
INSERT INTO semo.ontology_types (type_key, schema, description)
VALUES ('module', '{}', '플랫폼 하위 모듈/서브시스템')
ON CONFLICT (type_key) DO NOTHING;

-- 2. module 스키마 키 등록
-- spec은 manual (projection 아님) — 모듈은 PM 파이프라인 밖에서 직접 관리
INSERT INTO semo.kb_type_schema (type_key, scheme_key, key_type, required, scheme_description, sort_order, source) VALUES
  ('module', 'base-information', 'singleton',  true,  '모듈 개요',                    1,  'manual'),
  ('module', 'status',           'singleton',  true,  '상태 (active/hold/deprecated)', 2,  'manual'),
  ('module', 'tech-stack',       'singleton',  false, '기술 스택',                     3,  'manual'),
  ('module', 'repo',             'singleton',  false, 'GitHub 레포지토리',             4,  'manual'),
  ('module', 'slack-channel',    'singleton',  false, 'Slack 채널',                    5,  'manual'),
  ('module', 'reference',        'collection', false, '참조 문서',                     10, 'manual'),
  ('module', 'spec',             'collection', false, '스펙 (수동 관리)',              11, 'manual'),
  ('module', 'decision',         'collection', false, '의사결정 기록',                 12, 'manual'),
  ('module', 'process',          'collection', false, '프로세스',                      13, 'manual'),
  ('module', 'incident',         'collection', false, '인시던트',                      14, 'manual')
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- 3. parent 컬럼 인덱스 (컬럼은 migration 016에서 이미 추가됨)
CREATE INDEX IF NOT EXISTS idx_ontology_parent
  ON semo.ontology(parent) WHERE parent IS NOT NULL;

-- 4. semo-incubator 도메인 등록
INSERT INTO semo.ontology (domain, entity_type, description, service, parent, tags, schema)
VALUES (
  'semo-incubator',
  'module',
  'SEMO Incubator — 세모 인큐베이터. SEMO 봇팀 인프라를 활용한 서비스 기획/개발 프로그램.',
  'semo',
  'semo',
  ARRAY['module', 'incubator'],
  '{}'
)
ON CONFLICT (domain) DO NOTHING;

COMMIT;
