-- 078: Incubator Agent 등록
-- incubator 전용 에이전트: 인큐베이터 파이프라인 오케스트레이션 전담

-- 1. bot_status 등록
INSERT INTO semo.bot_status (bot_id, name, emoji, role, status, workspace_path)
VALUES ('incubator', 'Incubator', ':hatching_chick:', 'Incubator Pipeline Orchestrator', 'online', '~/.semo-bot-sessions/incubator')
ON CONFLICT (bot_id) DO UPDATE SET status = 'online', role = EXCLUDED.role, name = EXCLUDED.name, emoji = EXCLUDED.emoji;

-- 2. ontology 도메인 등록 (agents 타입)
INSERT INTO semo.ontology (domain, entity_type, description, parent, schema)
VALUES ('incubator', 'agents', 'Incubator Pipeline Orchestrator', 'semo', '{}'::jsonb)
ON CONFLICT (domain) DO UPDATE SET entity_type = 'agents', description = EXCLUDED.description;

-- 3. orchestrator → incubator 키워드 라우팅
INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, is_active, metadata)
VALUES ('orchestrator', 'incubator', 'routing',
  ARRAY['인큐베이팅','인큐베이터','incubator','incubating','샌드박스 시작','sandbox create'],
  'keyword', true, '{"label":"incubator","order":0}')
ON CONFLICT (from_bot_id, to_bot_id, delegation_type, COALESCE(metadata->>'label', '')) DO NOTHING;

-- 4. orchestrator → incubator 스킬 라우팅
INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, is_active, metadata)
VALUES ('orchestrator', 'incubator', 'skill-routing',
  ARRAY['인큐베이팅 시작','인큐베이팅 진행','인큐베이팅 이어서','인큐베이팅 현황','인큐베이터 시작','sandbox'],
  'keyword', true, '{"skill":"semo-incubator","label":"incubator-skill"}')
ON CONFLICT (from_bot_id, to_bot_id, delegation_type, COALESCE(metadata->>'label', '')) DO NOTHING;

-- 5. incubator → 전문 봇 위임 (CP별)
INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, is_active, metadata) VALUES
  ('incubator', 'planclaw',   'task', ARRAY['planning','requirements','prd','cp-2','cp-3'],       'escalation', true, '{"label":"cp-plan"}'),
  ('incubator', 'designclaw', 'task', ARRAY['design','ui','ux','cp-3'],                           'escalation', true, '{"label":"cp-design"}'),
  ('incubator', 'infraclaw',  'task', ARRAY['infra','deploy','cp-4','cp-7','cp-8','cp-9'],        'escalation', true, '{"label":"cp-infra"}'),
  ('incubator', 'workclaw',   'task', ARRAY['implementation','dev','cp-5'],                       'escalation', true, '{"label":"cp-work"}'),
  ('incubator', 'reviewclaw', 'task', ARRAY['review','qa','cp-6'],                                'escalation', true, '{"label":"cp-review"}'),
  ('incubator', 'growthclaw', 'task', ARRAY['growth','marketing','cp-9'],                         'escalation', true, '{"label":"cp-growth"}')
ON CONFLICT (from_bot_id, to_bot_id, delegation_type, COALESCE(metadata->>'label', '')) DO NOTHING;

-- 6. semo-incubator 스킬을 incubator 봇으로 이전
UPDATE semo.skill_definitions
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{bot_ids}',
  '["incubator"]'::jsonb
)
WHERE name = 'semo-incubator';
