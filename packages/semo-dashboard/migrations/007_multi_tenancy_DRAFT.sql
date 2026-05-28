-- SEMO Dashboard v5 — Multi-tenancy foundation (DRAFT — DO NOT RUN AS-IS)
--
-- Track B Pre-design 결정문 §1 참조: docs/plans/2026-05-27-semo-dashboard-v5-track-b-predesign.md
-- 이 마이그레이션은 Customer/Provider 모드 분기 + 멀티 워크스페이스의 기반을 만든다.
--
-- ⚠️ 검토 사항 (실행 전 확정):
--   a) 디폴트 tenant slug 명명 규칙 ('semicolon' vs 'semicolon-team')
--   b) personal tenant 자동 생성을 가입 시점에 할지, 첫 결제 시점에 할지
--   c) SEMO core (packages/cli/migrations/) 의 KB·agent_definitions·action_items 에 tenant_id 추가는
--      별도 마이그레이션으로 (이 파일은 dashboard 스코프만)
--   d) 기존 user_menu_access·user_project_access 의 의미 재정의 — tenant-scoped 로
--
-- 이 파일은 supabase SQL editor 실행 전 dry-run 필수.

-- ============================================================================
-- 1) tenants — 워크스페이스 (개인 가게 / 팀 / 프로바이더)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,                          -- URL-safe, immutable after first publish
  display_name TEXT NOT NULL,                         -- "강남 커피 로스터스", "세미콜론 팀"
  tenant_type TEXT NOT NULL DEFAULT 'personal'
    CHECK (tenant_type IN ('personal', 'team', 'provider')),
  owner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  business_registration_no TEXT,                      -- 사업자등록번호 (세금계산서용, 평문이지만 RLS로 가림)
  current_plan_id UUID,                               -- FK 는 plans 테이블 생성 후 추가
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON public.tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_type ON public.tenants(tenant_type);

-- ============================================================================
-- 2) tenant_members — 1 user × N tenants (가족 공동운영·팀 협업)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES public.user_profiles(id),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);

-- ============================================================================
-- 3) user_profiles 확장 — provider 토글 + 디폴트 워크스페이스
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_provider BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_tenant_id UUID REFERENCES public.tenants(id);

-- 기존 admin → is_provider 자동 부여
UPDATE public.user_profiles
  SET is_provider = TRUE
  WHERE role = 'admin' AND is_provider = FALSE;

-- ============================================================================
-- 4) RLS 헬퍼 함수
-- ============================================================================

-- 세션 헤더 X-Tenant-Id 에서 현재 tenant 획득 (set_config 로 미들웨어가 주입)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = tid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(tid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = tid AND user_id = auth.uid()
      AND member_role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Provider 모드 권한 — admin OR is_provider=TRUE
CREATE OR REPLACE FUNCTION public.is_provider()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_provider = TRUE)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 5) RLS 활성화 + 정책
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- tenants: 멤버이거나 provider 인 경우 조회
CREATE POLICY "tenants_select_member"
  ON public.tenants FOR SELECT
  USING (public.is_tenant_member(id) OR public.is_provider());

CREATE POLICY "tenants_insert_self"
  ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "tenants_update_admin"
  ON public.tenants FOR UPDATE
  USING (public.is_tenant_admin(id) OR public.is_provider());

CREATE POLICY "tenants_delete_owner"
  ON public.tenants FOR DELETE
  USING (auth.uid() = owner_user_id OR public.is_provider());

-- tenant_members: 같은 tenant 의 멤버끼리 조회
CREATE POLICY "tenant_members_select"
  ON public.tenant_members FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.is_provider());

CREATE POLICY "tenant_members_insert_admin"
  ON public.tenant_members FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id) OR public.is_provider());

CREATE POLICY "tenant_members_update_admin"
  ON public.tenant_members FOR UPDATE
  USING (public.is_tenant_admin(tenant_id) OR public.is_provider());

CREATE POLICY "tenant_members_delete_admin"
  ON public.tenant_members FOR DELETE
  USING (public.is_tenant_admin(tenant_id) OR public.is_provider());

-- ============================================================================
-- 6) 기존 ACL 테이블 tenant 스코프화
-- ============================================================================

ALTER TABLE public.user_menu_access
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.user_project_access
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 백필: 기존 row 는 곧 만들 'semicolon' tenant 로 귀속 (Step 7 에서 처리)

-- ============================================================================
-- 7) 백필 — 세미콜론 팀 디폴트 tenant + 기존 사용자 personal tenant
-- ============================================================================

DO $$
DECLARE
  semicolon_tenant_id UUID;
  first_admin_id UUID;
  rec RECORD;
BEGIN
  -- 7-1) 최초 admin 1명을 owner 로 'semicolon' tenant 생성
  SELECT id INTO first_admin_id FROM public.user_profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  IF first_admin_id IS NOT NULL THEN
    INSERT INTO public.tenants (slug, display_name, tenant_type, owner_user_id)
      VALUES ('semicolon', '세미콜론 팀', 'provider', first_admin_id)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO semicolon_tenant_id;

    IF semicolon_tenant_id IS NULL THEN
      SELECT id INTO semicolon_tenant_id FROM public.tenants WHERE slug = 'semicolon';
    END IF;

    -- 7-2) 기존 admin 들을 semicolon tenant 에 owner/admin 으로 추가
    INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
      SELECT semicolon_tenant_id, id,
             CASE WHEN id = first_admin_id THEN 'owner' ELSE 'admin' END
        FROM public.user_profiles WHERE role = 'admin'
      ON CONFLICT (tenant_id, user_id) DO NOTHING;

    -- 7-3) 기존 ACL row 들을 semicolon tenant 로 백필
    UPDATE public.user_menu_access SET tenant_id = semicolon_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.user_project_access SET tenant_id = semicolon_tenant_id WHERE tenant_id IS NULL;

    -- 7-4) admin 들의 default_tenant_id = semicolon
    UPDATE public.user_profiles SET default_tenant_id = semicolon_tenant_id WHERE role = 'admin';
  END IF;

  -- 7-5) member 사용자들 → 각자 personal tenant
  FOR rec IN SELECT id, email FROM public.user_profiles WHERE role = 'member' LOOP
    INSERT INTO public.tenants (slug, display_name, tenant_type, owner_user_id)
      VALUES (
        'user-' || replace(rec.id::text, '-', ''),
        COALESCE(split_part(rec.email, '@', 1), '내 가게'),
        'personal',
        rec.id
      )
      ON CONFLICT (slug) DO NOTHING;

    INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
      SELECT id, rec.id, 'owner' FROM public.tenants
      WHERE owner_user_id = rec.id AND tenant_type = 'personal'
      ON CONFLICT (tenant_id, user_id) DO NOTHING;

    UPDATE public.user_profiles
      SET default_tenant_id = (SELECT id FROM public.tenants WHERE owner_user_id = rec.id AND tenant_type = 'personal' LIMIT 1)
      WHERE id = rec.id;
  END LOOP;
END $$;

-- 백필 후 tenant_id NOT NULL 강제
ALTER TABLE public.user_menu_access
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_project_access
  ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- 8) 신규 사용자 트리거 — personal tenant 자동 생성
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (slug, display_name, tenant_type, owner_user_id)
  VALUES (
    'user-' || replace(NEW.id::text, '-', ''),
    COALESCE(split_part(NEW.email, '@', 1), '내 가게'),
    'personal',
    NEW.id
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
    VALUES (new_tenant_id, NEW.id, 'owner');

  UPDATE public.user_profiles SET default_tenant_id = new_tenant_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_profile_created_tenant ON public.user_profiles;
CREATE TRIGGER on_user_profile_created_tenant
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tenant();

-- ============================================================================
-- 9) 후속 마이그레이션 안내 (이 파일 범위 밖)
-- ============================================================================
-- (a) packages/cli/migrations/108_*.sql — semo.knowledge_base, semo.action_items,
--     semo.bot_commitments, semo.agent_definitions 에 tenant_id 추가 + 백필
-- (b) middleware.ts 에 X-Tenant-Id 헤더 → set_config('app.current_tenant_id') 주입 로직
-- (c) lib/auth/provider.tsx 에 currentTenant + tenants 컨텍스트 추가
-- (d) GlobalNav 에 워크스페이스 스위처 UI 추가 (provider 토글 포함)
