-- SEMO Dashboard — 에이전트 라이브러리 템플릿 persona + 고객 커스터마이즈 (appdb / public)
--
-- 목적: ~claw 내부 봇 스펙에서 공통화한 "역할 템플릿"을 라이브러리에 담고,
--   고객 테넌트가 라이브러리/plain 템플릿 기반으로 설치 → 닉네임(instance_name) + 본인 환경
--   커스터마이즈(persona_override)까지 할 수 있게 한다.
--
-- 런타임 soul 해소(customer-runtime.ts resolveCustomerSoul):
--   고객 persona_override > 라이브러리 persona_template > listing 메타 합성.
--   템플릿의 {회사명}/{회사} 플레이스홀더는 프로젝션 시 테넌트명으로 치환.
--
-- 적용: 멱등. (ALTER ... ADD COLUMN IF NOT EXISTS)

BEGIN;

-- 라이브러리 리스팅에 역할 템플릿 soul + 템플릿 플래그
ALTER TABLE public.agent_listings ADD COLUMN IF NOT EXISTS persona_template text;
ALTER TABLE public.agent_listings ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- 설치 인스턴스별 고객 커스터마이즈(페르소나 덮어쓰기). instance_name = 고객이 정한 닉네임.
ALTER TABLE public.agent_installs ADD COLUMN IF NOT EXISTS persona_override text;

COMMIT;
