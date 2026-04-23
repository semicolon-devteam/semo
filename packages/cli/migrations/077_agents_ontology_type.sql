-- 077: agents 온톨로지 타입 + Architecture B 에이전트 KB 시딩
BEGIN;

-- 1. agents 타입 생성
INSERT INTO semo.ontology_types (type_key, description)
VALUES ('agents', 'Architecture B 에이전트 — 정체성, 위임, 도구, 슬랙 프로필')
ON CONFLICT (type_key) DO NOTHING;

-- 2. 스키마 키 등록
INSERT INTO semo.kb_type_schema (type_key, scheme_key, scheme_description, required, value_hint, sort_order, key_type) VALUES
  ('agents', 'identity',       '에이전트 기본 정보 (이름, 이모지, 역할)',               true,  'YAML: name, emoji, tagline, role, agent_type (orchestrator|specialist)', 1, 'singleton'),
  ('agents', 'model-config',   '모델 설정 (기본 모델, 예산, opus 트리거)',              true,  'YAML: base_model, max_turns, max_budget, opus_trigger_keywords[]', 2, 'singleton'),
  ('agents', 'delegation',     '담당 도메인 + 위임 규칙',                              true,  '마크다운: 담당 키워드, 에스컬레이션 대상', 3, 'singleton'),
  ('agents', 'tools',          '사용 가능한 도구 목록',                                false, 'YAML: tools[], mcp_servers{}', 4, 'singleton'),
  ('agents', 'skills',         '할당된 스킬 목록',                                     false, '스킬 이름 + 트리거 키워드', 5, 'collection'),
  ('agents', 'slack-profile',  'Slack 표시 정체성',                                    true,  'YAML: username, icon_emoji, slack_user_id', 6, 'singleton'),
  ('agents', 'kb-access',      'KB 접근 허용 도메인 목록',                              false, 'YAML: domains[] (빈 = 전체 허용)', 7, 'singleton'),
  ('agents', 'status',         '현재 상태',                                            true,  'online | offline | maintenance', 8, 'singleton'),
  ('agents', 'cron-schedule',  '크론 작업 목록',                                       false, '마크다운: 스케줄 + 설명 테이블', 9, 'singleton')
ON CONFLICT (type_key, scheme_key) DO UPDATE SET
  scheme_description = EXCLUDED.scheme_description,
  required = EXCLUDED.required,
  value_hint = EXCLUDED.value_hint,
  sort_order = EXCLUDED.sort_order;

-- 3. 기존 bot 도메인 → agents 타입으로 전환
UPDATE semo.ontology
SET entity_type = 'agents'
WHERE entity_type = 'bot'
  AND domain IN (SELECT bot_id FROM semo.bot_status WHERE status != 'retired');

-- 4. identity 시딩 (bot_status → KB)
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
SELECT
  bs.bot_id, 'identity', '',
  format(E'name: %s\nemoji: %s\ntagline: %s\nrole: %s\nagent_type: %s',
    COALESCE(bs.name, bs.bot_id),
    COALESCE(bs.emoji, ':robot_face:'),
    COALESCE(bs.role, bs.bot_id || ' 에이전트'),
    COALESCE(bs.role, '-'),
    CASE WHEN bs.bot_id = 'semiclaw' THEN 'orchestrator' ELSE 'specialist' END
  ),
  '{}', 'migration-077'
FROM semo.bot_status bs
WHERE bs.status != 'retired'
ON CONFLICT (domain, key, sub_key) DO UPDATE SET
  content = EXCLUDED.content, updated_at = now();

-- 5. delegation 시딩 (bot_delegation → KB)
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
SELECT
  sub.to_bot_id, 'delegation', '',
  format(E'## 수신 키워드\n%s\n\n## 에스컬레이션\n- 담당 밖 요청 → escalate("semiclaw", reason, context)', sub.keyword_list),
  '{}', 'migration-077'
FROM (
  SELECT
    to_bot_id,
    string_agg('- ' || kw, E'\n' ORDER BY kw) AS keyword_list
  FROM (
    SELECT to_bot_id, unnest(domains) AS kw
    FROM semo.bot_delegation
    WHERE is_active = true
  ) expanded
  GROUP BY to_bot_id
) sub
ON CONFLICT (domain, key, sub_key) DO UPDATE SET
  content = EXCLUDED.content, updated_at = now();

-- 6. model-config 시딩
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by) VALUES
  ('semiclaw',   'model-config', '', E'base_model: sonnet\nmax_turns: 50\nmax_budget: 1.5',  '{}', 'migration-077'),
  ('planclaw',   'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 1.0',  '{}', 'migration-077'),
  ('designclaw', 'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 1.0',  '{}', 'migration-077'),
  ('workclaw',   'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 1.5',  '{}', 'migration-077'),
  ('reviewclaw', 'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 0.8',  '{}', 'migration-077'),
  ('infraclaw',  'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 1.0',  '{}', 'migration-077'),
  ('growthclaw', 'model-config', '', E'base_model: sonnet\nmax_turns: 40\nmax_budget: 0.5',  '{}', 'migration-077')
ON CONFLICT (domain, key, sub_key) DO UPDATE SET
  content = EXCLUDED.content, updated_at = now();

-- 7. status 시딩
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
SELECT bot_id, 'status', '', COALESCE(status, 'online'), '{}', 'migration-077'
FROM semo.bot_status WHERE status != 'retired'
ON CONFLICT (domain, key, sub_key) DO UPDATE SET
  content = EXCLUDED.content, updated_at = now();

-- 8. bot 타입 deprecated 마킹
UPDATE semo.ontology_types
SET description = '[DEPRECATED — agents 타입 사용] OpenClaw 봇 에이전트'
WHERE type_key = 'bot';

COMMIT;
