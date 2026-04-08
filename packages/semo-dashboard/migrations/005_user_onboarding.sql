-- SEMO Dashboard 온보딩 플로우 (Supabase: zorienqtiaxyuozhxwdj)
-- 실행: Supabase Dashboard > SQL Editor

-- 1) user_profiles에 온보딩 컬럼 추가
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'none'
    CHECK (onboarding_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS onboarding_role TEXT
    CHECK (onboarding_role IN ('team-member', 'incubator-participant')),
  ADD COLUMN IF NOT EXISTS linked_domain TEXT,
  ADD COLUMN IF NOT EXISTS linked_service_id UUID;

-- 2) 동일 KB 도메인 중복 선택 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_linked_domain
  ON public.user_profiles (linked_domain) WHERE linked_domain IS NOT NULL;

-- 3) 일반 사용자가 본인 온보딩 정보를 수정할 수 있도록 RLS 정책 추가
CREATE POLICY "profiles_update_own_onboarding"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4) 기존 사용자 → approved 처리 (무중단)
-- ⚠️ 코드 배포와 동시에 실행할 것 (중간에 가입하는 사용자 방지)
UPDATE public.user_profiles
  SET onboarding_status = 'approved'
  WHERE onboarding_status = 'none';
