-- SEMO Dashboard v5 — Customer 결제/구독 테이블 (appdb / public 스키마)
--
-- 010_customer_tables.sql 의 아키텍처를 그대로 따른다: appdb(public), Supabase FK 없음,
-- RLS 미사용(서버 trusted), tenant 격리는 쿼리 레이어(WHERE tenant_id).
--
-- 데이터 모델만 정의한다. 실제 결제 실행(포트원 V2 결제창/빌링키, 팝빌 세금계산서)은
-- merchant 크리덴셜이 필요하므로 별도 통합 레이어에서 처리하고, payment_events 에 결과를
-- 적재한다. 이 마이그레이션은 그 적재 대상 + 플랜 카탈로그 + 구독/사용량을 만든다.
--
-- 적용: scripts/apply-customer-tables.mjs (010 과 함께, 멱등). 로컬 appdb 전용.

BEGIN;

CREATE TABLE IF NOT EXISTS public.plans (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  price_krw   int  NOT NULL DEFAULT 0,
  period      text NOT NULL DEFAULT 'month',     -- 'month' | '' (free)
  blurb       text,
  features    jsonb NOT NULL DEFAULT '[]'::jsonb, -- [["동시 채용 가능","3명"], ...]
  recommended boolean NOT NULL DEFAULT false,
  sort        int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_slug       text NOT NULL REFERENCES public.plans(slug),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','past_due','canceled','trialing')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  next_billing_at timestamptz,
  payment_method  jsonb,                          -- {brand,last4,holder,exp}
  UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS public.usage_meters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric       text NOT NULL,                     -- 'ai_responses' | 'kb_storage_mb' | 'employees'
  used         int  NOT NULL DEFAULT 0,
  limit_val    int,                               -- NULL = 무제한
  period_start date NOT NULL DEFAULT now()::date,
  UNIQUE(tenant_id, metric, period_start)
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type    text NOT NULL DEFAULT 'charge'
                  CHECK (event_type IN ('charge','refund','tax_invoice')),
  amount_krw    int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'paid'
                  CHECK (status IN ('paid','pending','failed','free')),
  invoice_label text,                             -- '5월 청구서'
  provider_ref  text,                             -- 포트원 imp_uid / 팝빌 mgtKey (실연동 시)
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_tenant ON public.payment_events(tenant_id, occurred_at DESC);

COMMIT;
