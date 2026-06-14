-- Semicolony internal environment as installed agents.
--
-- Decision: semicolony/decision/internal-agent-install-model-parity-2026-06-11
-- Internal agents use the same product install model as customer agents:
-- agent_listings(audience='internal') -> agent_installs -> bot_status projection.

BEGIN;

INSERT INTO public.tenants (slug, display_name, tenant_type, owner_user_id, plan_slug, metadata)
VALUES (
  'team-semicolon',
  '세미콜론 팀',
  'team',
  NULL,
  'internal',
  '{"semicolony_internal":true}'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      metadata = public.tenants.metadata || EXCLUDED.metadata;

WITH internal_agents(agent_slug, display_name, role_label, dept, short_desc, skills) AS (
  VALUES
    ('semi', 'Semi', '업무 오케스트레이터', 'orchestration', '요청을 해석하고 적합한 설치 에이전트에 위임한다.', '["routing","delegation","reporting"]'::jsonb),
    ('colony', 'Colony', '지식·맥락 관리자', 'knowledge', '채널과 문서에서 지식을 수집하고 KB/관계 그래프를 갱신한다.', '["kb","memory","relation-extraction"]'::jsonb),
    ('operator', 'Operator', '운영 자동화 에이전트', 'operations', '런타임 장애, 코드 작업 요청, 운영 절차를 분석하고 실행한다.', '["runtime","diagnostics","automation"]'::jsonb),
    ('semiclaw', 'SemiClaw', '플랫폼 PM/오케스트레이션 역할 에이전트', 'orchestration', '세미콜론 개발팀 운영과 위임을 조율한다.', '["pm","delegation","github"]'::jsonb),
    ('planclaw', 'PlanClaw', '기획·PO 역할 에이전트', 'planning', '요구사항, PRD, 제품 방향을 구조화한다.', '["planning","prd","deep-interview"]'::jsonb),
    ('reviewclaw', 'ReviewClaw', '리뷰·QA 역할 에이전트', 'review', '코드와 설계를 검토하고 회귀 위험을 찾는다.', '["code-review","qa","risk"]'::jsonb),
    ('workclaw', 'WorkClaw', '구현 역할 에이전트', 'engineering', '기능 구현과 버그 수정을 담당한다.', '["coding","implementation","debugging"]'::jsonb),
    ('designclaw', 'DesignClaw', '디자인·프론트엔드 역할 에이전트', 'design', 'UI/UX와 시각 품질을 개선한다.', '["ui","ux","frontend"]'::jsonb),
    ('growthclaw', 'GrowthClaw', '그로스·마케팅 역할 에이전트', 'growth', 'SEO, 콘텐츠, 지표 개선을 담당한다.', '["seo","marketing","analytics"]'::jsonb),
    ('infraclaw', 'InfraClaw', '인프라·운영 역할 에이전트', 'infra', '배포, CI/CD, 런타임 인프라를 담당한다.', '["infra","deploy","ci"]'::jsonb)
)
INSERT INTO public.agent_listings
  (agent_slug, display_name, role_label, dept, short_desc, skills, audience, visibility, review_status, price_tier)
SELECT
  agent_slug,
  display_name,
  role_label,
  dept,
  short_desc,
  skills,
  'internal',
  'private',
  'approved',
  'Internal'
FROM internal_agents
ON CONFLICT (agent_slug) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      role_label = EXCLUDED.role_label,
      dept = EXCLUDED.dept,
      short_desc = EXCLUDED.short_desc,
      skills = EXCLUDED.skills,
      audience = EXCLUDED.audience,
      visibility = EXCLUDED.visibility,
      review_status = EXCLUDED.review_status,
      price_tier = EXCLUDED.price_tier;

INSERT INTO public.agent_installs (tenant_id, listing_id, instance_name, install_status, today_summary, avatar_state, last_activity_at)
SELECT
  t.id,
  l.id,
  l.display_name,
  'active',
  'Semicolony internal installed agent',
  'idle',
  now()
FROM public.tenants t
JOIN public.agent_listings l
  ON l.agent_slug IN (
    'semi',
    'colony',
    'operator',
    'semiclaw',
    'planclaw',
    'reviewclaw',
    'workclaw',
    'designclaw',
    'growthclaw',
    'infraclaw'
  )
WHERE t.slug = 'team-semicolon'
ON CONFLICT (tenant_id, listing_id, instance_name) DO UPDATE
  SET install_status = 'active',
      today_summary = EXCLUDED.today_summary;

COMMIT;
