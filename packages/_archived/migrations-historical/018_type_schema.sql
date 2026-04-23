-- 018_type_schema.sql
-- kb_type_schema 테이블: 타입별 키 스키마 매핑
-- AI가 KB 엔트리 생성 시 구조적 가이드라인 제공
--
-- 선행 조건: 017_ontology_instance_model.sql 적용 완료

BEGIN;

-- ============================================================
-- 1. kb_type_schema 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.kb_type_schema (
  id                BIGSERIAL PRIMARY KEY,
  type_key          VARCHAR(100) NOT NULL REFERENCES semo.ontology_types(type_key),
  scheme_key        VARCHAR(100) NOT NULL,
  scheme_description TEXT NOT NULL,
  required          BOOLEAN DEFAULT false,
  value_hint        TEXT,
  sort_order        INT DEFAULT 0,
  UNIQUE (type_key, scheme_key)
);

-- ============================================================
-- 2. 서비스(service) 타입 스키마 시드
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order) VALUES
  ('service', 'base_information',   '서비스 기본 설명',              true,  NULL,                                              1),
  ('service', 'current_situation',  '현재 상황/진행 중 작업',         false, NULL,                                              2),
  ('service', 'po',                 '프로젝트 오너 (담당자)',         true,  '예: reus, bae',                                   3),
  ('service', 'service_url',        '서비스 URL',                   false, 'https://...',                                     4),
  ('service', 'bm',                 '비즈니스 모델',                 false, NULL,                                              5),
  ('service', 'tech_stack',         '기술 스택',                     false, '예: Next.js, PostgreSQL, TypeScript',              6),
  ('service', 'status',             '상태',                         true,  'active | hold | deprecated | completed',          7),
  ('service', 'repo',               'GitHub 레포지토리',             false, '예: semicolon/axoracle',                          8),
  ('service', 'slack_channel',      'Slack 채널',                   false, '예: #axoracle',                                   9)
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- ============================================================
-- 3. 조직(organization) 타입 스키마 시드
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order) VALUES
  ('organization', 'base_information',           '조직 기본 설명',        true,  NULL,                             1),
  ('organization', 'team/{name}',                '팀원 정보',            false, 'team/ 프리픽스 + 이름',            2),
  ('organization', 'decision/{date}/{slug}',     '의사결정 기록',         false, 'decision/YYYY-MM-DD/slug',       3),
  ('organization', 'process/{name}',             '업무 프로세스',         false, 'process/ 프리픽스 + 이름',         4),
  ('organization', 'infra/{name}',               '인프라 구성',          false, 'infra/ 프리픽스 + 이름',           5),
  ('organization', 'bot-config/{botId}/{type}',  '봇 설정',             false, 'bot-config/semiclaw/identity',    6),
  ('organization', 'skill/{botId}/{skillName}',  '스킬 정의',            false, 'skill/semiclaw/kb-manager',      7),
  ('organization', 'spec/{specName}',            '스펙/설계 문서',        false, 'spec/...',                       8),
  ('organization', 'memory/{sourceId}/{date}',   '메모리 (L2)',          false, 'memory/semiclaw/2026-03-20',     9),
  ('organization', 'session-log/{id}',           '세션 로그',            false, 'session-log/...',               10)
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- ============================================================
-- 4. KPI 타입 스키마 시드
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order) VALUES
  ('kpi', 'current',    '현재 KPI',        true,  NULL,             1),
  ('kpi', 'target',     '목표 KPI',        false, NULL,             2),
  ('kpi', '{YYYY-WNN}', '주간 KPI 스냅샷',  false, '예: 2026-W12',   3)
ON CONFLICT (type_key, scheme_key) DO NOTHING;

-- ============================================================
-- 5. Milestone 타입 스키마 시드
-- ============================================================

INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order) VALUES
  ('milestone', '{slug}', '마일스톤 항목', true, '예: blog-auto-gen, seo-phase1', 1)
ON CONFLICT (type_key, scheme_key) DO NOTHING;

COMMIT;
