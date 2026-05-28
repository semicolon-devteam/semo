-- SEMO Dashboard v5 — Agent Library publishing & install (DRAFT — DO NOT RUN AS-IS)
--
-- Track B Pre-design 결정문 §3 참조.
-- 007_multi_tenancy_DRAFT.sql 실행 이후에 적용한다.
--
-- 목표:
--   (1) 에이전트에 가시성(visibility) — preset/community/private — 부여
--   (2) Customer 가 라이브러리에서 봇을 "채용" 하면 install 레코드 생성
--   (3) 사용자 제출 봇은 review_status 큐로 들어가 Provider 가 검수
--   (4) 다운로드 수·평점·문제 리포트 집계
--
-- ⚠️ 검토 사항:
--   a) semo.agent_definitions 는 SEMO core 스키마. 본 마이그레이션은 dashboard 스코프
--      추가 테이블만 만들고, core 테이블 ALTER 는 packages/cli/migrations/ 으로 분리한다.
--   b) 검수 자동화 (안전·중복·품질) 규칙은 별도 워커가 구현
--   c) 가격 영향 (free / addon / plan-required) 은 plans 마이그레이션 (010 예정) 과 join

-- ============================================================================
-- 1) agent_listings — 라이브러리에 노출되는 카탈로그 엔트리
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SEMO core agent_definitions 와 1:1 (slug 매칭 — FK 가 다른 스키마라 soft ref)
  agent_slug TEXT NOT NULL UNIQUE,

  -- Customer-facing 표시 정보 (7봇 코드명과는 별개)
  display_name TEXT NOT NULL,                          -- "주문이"
  role_label TEXT NOT NULL,                            -- "주문 응대 직원"
  short_description TEXT NOT NULL,                     -- 카드용 1줄
  long_description TEXT,                               -- 상세 페이지 markdown
  category TEXT NOT NULL,                              -- 응대/회계/마케팅/재고/스케줄링/리포트/기타
  avatar_url TEXT,                                     -- 캐릭터 일러스트
  accent_color TEXT,                                   -- 카드 액센트 (hex)

  -- 가시성·소유
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'community', 'preset')),
  publisher_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,

  -- 검수
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected', 'deprecated')),
  review_notes TEXT,                                   -- 검수 코멘트
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,

  -- 가격
  price_model TEXT NOT NULL DEFAULT 'included'
    CHECK (price_model IN ('included', 'addon', 'plan_required')),
  price_addon_krw INTEGER,                             -- price_model='addon' 일 때만
  required_plan_slug TEXT,                             -- price_model='plan_required' 일 때만

  -- 권한 (소상공인이 "내 카카오톡 연결" 등 OAuth scope 들을 미리 표시)
  required_integrations TEXT[] NOT NULL DEFAULT '{}',  -- {'kakao_chat','smartstore','google_calendar'}

  -- 집계 (트리거로 자동 업데이트 — Step 4)
  install_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_listings_visibility ON public.agent_listings(visibility);
CREATE INDEX IF NOT EXISTS idx_agent_listings_review_status ON public.agent_listings(review_status);
CREATE INDEX IF NOT EXISTS idx_agent_listings_category ON public.agent_listings(category);
CREATE INDEX IF NOT EXISTS idx_agent_listings_publisher ON public.agent_listings(publisher_tenant_id);

-- ============================================================================
-- 2) agent_installs — Customer 가 채용한 인스턴스
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.agent_listings(id) ON DELETE RESTRICT,

  -- 사용자가 채용 시 직접 정한 이름 ("주문이" 같은 닉네임)
  instance_name TEXT NOT NULL,

  -- 채용 마법사에서 연결한 권한·설정 (OAuth 토큰 ref 등)
  installed_integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 상태
  install_status TEXT NOT NULL DEFAULT 'active'
    CHECK (install_status IN ('active', 'paused', 'error', 'uninstalled')),
  error_message TEXT,

  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,

  UNIQUE(tenant_id, listing_id, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_installs_tenant ON public.agent_installs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_installs_listing ON public.agent_installs(listing_id);
CREATE INDEX IF NOT EXISTS idx_agent_installs_status ON public.agent_installs(install_status);

-- ============================================================================
-- 3) agent_reviews — 다른 사장님 리뷰
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.agent_listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, tenant_id)                        -- tenant 1개당 1리뷰
);

CREATE INDEX IF NOT EXISTS idx_agent_reviews_listing ON public.agent_reviews(listing_id);

-- ============================================================================
-- 4) 집계 트리거 — install_count / rating
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_agent_listing_stats(p_listing_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.agent_listings SET
    install_count = (
      SELECT COUNT(*) FROM public.agent_installs
      WHERE listing_id = p_listing_id AND install_status = 'active'
    ),
    rating_avg = (
      SELECT ROUND(AVG(rating)::numeric, 2) FROM public.agent_reviews
      WHERE listing_id = p_listing_id
    ),
    rating_count = (
      SELECT COUNT(*) FROM public.agent_reviews WHERE listing_id = p_listing_id
    ),
    updated_at = NOW()
  WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_refresh_listing_on_install()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_agent_listing_stats(COALESCE(NEW.listing_id, OLD.listing_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_install_refresh ON public.agent_installs;
CREATE TRIGGER tr_install_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_installs
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_listing_on_install();

DROP TRIGGER IF EXISTS tr_review_refresh ON public.agent_reviews;
CREATE TRIGGER tr_review_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_listing_on_install();

-- ============================================================================
-- 5) RLS — visibility 별 노출 제어
-- ============================================================================

ALTER TABLE public.agent_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reviews ENABLE ROW LEVEL SECURITY;

-- agent_listings:
--  - preset: 모든 인증 사용자에게 노출
--  - community: review_status='approved' 일 때만 노출
--  - private: 본인 tenant 멤버에게만
--  - provider: 모두
CREATE POLICY "listings_select"
  ON public.agent_listings FOR SELECT
  USING (
    public.is_provider()
    OR visibility = 'preset'
    OR (visibility = 'community' AND review_status = 'approved')
    OR (visibility = 'private' AND public.is_tenant_member(publisher_tenant_id))
  );

CREATE POLICY "listings_insert_own_tenant"
  ON public.agent_listings FOR INSERT
  WITH CHECK (public.is_tenant_admin(publisher_tenant_id));

CREATE POLICY "listings_update_own_or_provider"
  ON public.agent_listings FOR UPDATE
  USING (public.is_tenant_admin(publisher_tenant_id) OR public.is_provider());

CREATE POLICY "listings_delete_own_or_provider"
  ON public.agent_listings FOR DELETE
  USING (public.is_tenant_admin(publisher_tenant_id) OR public.is_provider());

-- agent_installs: 본인 tenant 의 install 만 + provider 는 전부
CREATE POLICY "installs_select_tenant"
  ON public.agent_installs FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.is_provider());

CREATE POLICY "installs_insert_tenant"
  ON public.agent_installs FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "installs_update_tenant"
  ON public.agent_installs FOR UPDATE
  USING (public.is_tenant_admin(tenant_id) OR public.is_provider());

CREATE POLICY "installs_delete_tenant"
  ON public.agent_installs FOR DELETE
  USING (public.is_tenant_admin(tenant_id) OR public.is_provider());

-- agent_reviews: 누구나 읽기, 본인 tenant 의 install 이 있을 때만 작성
CREATE POLICY "reviews_select_all"
  ON public.agent_reviews FOR SELECT USING (TRUE);

CREATE POLICY "reviews_insert_installed"
  ON public.agent_reviews FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.agent_installs
      WHERE tenant_id = agent_reviews.tenant_id
        AND listing_id = agent_reviews.listing_id
    )
  );

CREATE POLICY "reviews_update_own"
  ON public.agent_reviews FOR UPDATE
  USING (auth.uid() = reviewer_user_id);

CREATE POLICY "reviews_delete_own_or_provider"
  ON public.agent_reviews FOR DELETE
  USING (auth.uid() = reviewer_user_id OR public.is_provider());

-- ============================================================================
-- 6) 후속 마이그레이션 안내
-- ============================================================================
-- (a) packages/cli/migrations/109_*.sql — semo.agent_definitions 에 listing_id 컬럼 추가하여
--     "이 봇 정의는 어떤 listing 에서 왔는가" 추적
-- (b) 검수 자동 진단 워커: 안전 (악성 프롬프트 패턴), 중복 (임베딩 유사도 > 0.95),
--     품질 (필수 메타 누락) 체크 → review_status 자동 'pending' 진입 + 진단 결과는
--     agent_listings.metadata.diagnostics 에 저장
