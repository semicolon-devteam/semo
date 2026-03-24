-- 022_bot_ontology_type.sql
-- bot 타입을 온톨로지 + kb_type_schema에 추가하고, 봇을 도메인으로 등록

BEGIN;

-- 1. ontology_types에 bot 타입 추가
INSERT INTO semo.ontology_types (type_key, description)
VALUES ('bot', 'OpenClaw 봇 에이전트')
ON CONFLICT (type_key) DO NOTHING;

-- 2. bot 타입 scheme_key 정의 (KB 메타데이터 전용, 워크스페이스 파일은 bot_workspace_standard에서 관리)
INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order) VALUES
  ('bot', 'identity',       '봇 기본 정보 (이름, 이모지, 한 줄 설명)',    true,  'YAML: name, emoji, tagline',                 1),
  ('bot', 'role',            'R&R — 역할 범위, 담당 업무',                true,  '마크다운: 업무 범위 테이블',                    2),
  ('bot', 'status',          '현재 상태',                                true,  'online | offline | maintenance',              3),
  ('bot', 'delegation',      '인계 매트릭스 — 역할 밖 요청 라우팅',       false, '마크다운: 요청유형 → 인계봇 테이블',            4),
  ('bot', 'gateway_config',  '게이트웨이 설정 (포트, 토큰 경로)',         false, 'YAML: port, token_path, model',               5),
  ('bot', 'cron_schedule',   '크론 작업 목록',                           false, '마크다운: 스케줄 + 설명 테이블',                6),
  ('bot', 'slack_config',    'Slack 연동 (Bot ID, 채널)',                false, 'YAML: bot_id, channels[]',                    7)
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  scheme_description = EXCLUDED.scheme_description,
  required = EXCLUDED.required,
  value_hint = EXCLUDED.value_hint,
  sort_order = EXCLUDED.sort_order;

-- 3. 각 봇을 ontology 도메인으로 등록 (bot_status에서 동적 조회)
INSERT INTO semo.ontology (domain, entity_type, description, service, schema)
SELECT bot_id, 'bot',
       COALESCE(name, bot_id) || ' — ' || COALESCE(role, 'Bot'),
       bot_id,
       '{}'::jsonb
FROM semo.bot_status
WHERE bot_id != 'shared'
ON CONFLICT (domain) DO UPDATE SET
  entity_type = 'bot',
  description = EXCLUDED.description;

COMMIT;
