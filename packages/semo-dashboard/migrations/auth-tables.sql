-- SEMO Dashboard 인증 테이블 (Supabase: zorienqtiaxyuozhxwdj)
-- 실행: Supabase Dashboard > SQL Editor

-- 1. 사용자 프로필
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 메뉴 접근 권한
CREATE TABLE IF NOT EXISTS public.user_menu_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  UNIQUE(user_id, menu_key)
);

-- 4. 프로젝트 접근 권한
CREATE TABLE IF NOT EXISTS public.user_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL,
  UNIQUE(user_id, service_id)
);

-- 5. admin 판별 헬퍼 함수 (테이블 생성 후)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. RLS 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책: user_profiles
CREATE POLICY "profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_admin"
  ON public.user_profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "profiles_insert_admin"
  ON public.user_profiles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin"
  ON public.user_profiles FOR DELETE
  USING (public.is_admin());

-- 7. RLS 정책: user_menu_access
CREATE POLICY "menu_select_own"
  ON public.user_menu_access FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "menu_insert_admin"
  ON public.user_menu_access FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "menu_update_admin"
  ON public.user_menu_access FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "menu_delete_admin"
  ON public.user_menu_access FOR DELETE
  USING (public.is_admin());

-- 8. RLS 정책: user_project_access
CREATE POLICY "project_select_own"
  ON public.user_project_access FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "project_insert_admin"
  ON public.user_project_access FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "project_update_admin"
  ON public.user_project_access FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "project_delete_admin"
  ON public.user_project_access FOR DELETE
  USING (public.is_admin());

-- 9. 신규 사용자 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. 초기 admin 시드 (Reus 계정 로그인 후 수동 실행)
-- UPDATE public.user_profiles SET role = 'admin' WHERE email = 'YOUR_GOOGLE_EMAIL';
