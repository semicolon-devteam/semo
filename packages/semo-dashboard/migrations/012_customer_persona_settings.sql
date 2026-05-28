-- SEMO Dashboard v5 — Customer persona 설정 (appdb / public 스키마)
--
-- "사용자 계정은 처음에 모드(페르소나)를 선택" — lib/customer/persona/resolve.ts 가 이미
-- 조회하는 테이블을 실제로 만든다. persona_id ∈ {shop, personal, worker}.
-- 010 아키텍처 동일: appdb(public), Supabase FK 없음(user_id 는 auth UUID 논리참조), RLS 미사용.
-- 적용: scripts/apply-customer-tables.mjs (멱등, 로컬 appdb 전용).

BEGIN;

-- 사용자별 선택 페르소나 (가입 시 1회 선택, 나중에 변경 가능). resolve.ts 2)단계가 조회.
CREATE TABLE IF NOT EXISTS public.customer_user_settings (
  user_id    uuid PRIMARY KEY,                 -- Supabase auth id (논리 참조)
  persona_id text NOT NULL
               CHECK (persona_id IN ('shop','personal','worker')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 테넌트 기본 페르소나 (선택적, 팀/관리자가 지정). resolve.ts 3)단계가 조회.
CREATE TABLE IF NOT EXISTS public.customer_tenant_settings (
  tenant_id          uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_persona_id text NOT NULL
                       CHECK (default_persona_id IN ('shop','personal','worker')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMIT;
