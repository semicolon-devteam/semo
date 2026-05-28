-- SEMO Dashboard v5 — Customer 도메인 테이블 (appdb / public 스키마)
--
-- ⚠️ 아키텍처: 대시보드는 데이터를 appdb(DATABASE_URL, pg.Pool)에서 읽고,
-- 인증만 Supabase 를 쓴다. 따라서 고객 테이블은 appdb 에 두고 user_profiles(Supabase)
-- 로의 FK 를 두지 않는다. owner_user_id 는 Supabase auth UUID 를 논리 참조만 한다.
-- RLS 미사용(서버 pg 쿼리가 trusted) — tenant 격리는 쿼리 레이어(WHERE tenant_id)에서.
--
-- DRAFT 007/008(Supabase public + user_profiles FK 전제)을 이 아키텍처로 대체.
-- 적용: scripts/apply-customer-tables.mjs (node pg, 로컬 appdb) 또는 SQL Editor.
-- 멱등: create table if not exists + insert on conflict do nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  tenant_type   text NOT NULL DEFAULT 'personal'
                  CHECK (tenant_type IN ('personal','team','provider')),
  owner_user_id uuid,                       -- Supabase auth id (논리 참조, FK 없음)
  plan_slug     text NOT NULL DEFAULT 'starter',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_listings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug     text UNIQUE NOT NULL,
  display_name   text NOT NULL,
  role_label     text NOT NULL,
  dept           text,
  short_desc     text,
  category       text,
  color          text,                      -- 'var(--agent-peach)' 등
  accent         text,
  accessory_kind text,
  bio            text,
  skills         jsonb NOT NULL DEFAULT '[]'::jsonb,
  integrations   jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating         numeric(3,2),
  employers      int NOT NULL DEFAULT 0,
  price_tier     text NOT NULL DEFAULT 'Starter',
  visibility     text NOT NULL DEFAULT 'preset'
                   CHECK (visibility IN ('private','community','preset')),
  audience       text NOT NULL DEFAULT 'customer'   -- 'customer' | 'internal'
                   CHECK (audience IN ('customer','internal')),
  review_status  text NOT NULL DEFAULT 'approved'
                   CHECK (review_status IN ('draft','pending','approved','rejected','deprecated')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_listings_audience ON public.agent_listings(audience, review_status);

CREATE TABLE IF NOT EXISTS public.agent_installs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id     uuid NOT NULL REFERENCES public.agent_listings(id) ON DELETE RESTRICT,
  instance_name  text NOT NULL,
  install_status text NOT NULL DEFAULT 'active'
                   CHECK (install_status IN ('active','paused','error','uninstalled')),
  today_summary  text,
  avatar_state   text NOT NULL DEFAULT 'idle'
                   CHECK (avatar_state IN ('idle','working','resting','error')),
  installed_at   timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  UNIQUE(tenant_id, listing_id, instance_name)
);
CREATE INDEX IF NOT EXISTS idx_agent_installs_tenant ON public.agent_installs(tenant_id, install_status);

CREATE TABLE IF NOT EXISTS public.agent_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id  uuid REFERENCES public.agent_listings(id),
  verb        text NOT NULL,
  target      text,
  detail      text,
  is_ai       boolean NOT NULL DEFAULT true,
  status      text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_activity_tenant ON public.agent_activity(tenant_id, occurred_at DESC);

COMMIT;
