-- 129_kb_multitenant_gateway.sql
-- SemiColony 멀티테넌트 KB 게이트웨이 기반 스키마.
-- 결정: semicolony/decision/semicolony-gateway-tenancy-auth-persona-resolved
--       (+ 원 결정 semicolony-kb-access-via-multitenant-api-gateway)
-- 선례: 128_entity_relations.sql (tenant_id + scope CHECK), 107_agent_service_credentials.sql (token_hash vault).
--
-- 핵심 설계(zero blast radius):
--   - knowledge_base 에 tenant_id + scope 를 **가산적**으로 추가(기존 행은 전부 platform-global/NULL → 무변경).
--   - 물리적 키 격리는 per-tenant 도메인 `t-{tenantSlug}` 로 수행 → 기존 UNIQUE(domain,key,sub_key) 와
--     ON CONFLICT(domain,key,sub_key) 를 쓰는 10개 writer 를 **건드리지 않는다**(도메인이 테넌트를 내포).
--   - tenant_id 컬럼은 RLS(Phase 2)·cascade·분석·게이트웨이 이중검증용 비정규화.
--
-- 러너(db.ts)가 파일 전체를 BEGIN/COMMIT 으로 감싸고 `semo.` 한정자를 활성 스키마로 retarget 한다.
--   → 여기엔 트랜잭션 구문을 넣지 않는다. `public.` 은 retarget 대상이 아니므로 appdb 공용 스키마 그대로 유지.

-- ============================================================
-- 1) knowledge_base: 테넌트 스코프 (가산적·비파괴, 128 패턴 동형)
-- ============================================================
ALTER TABLE semo.knowledge_base
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'platform-global';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kb_scope_enum_chk'
      AND conrelid = 'semo.knowledge_base'::regclass
  ) THEN
    ALTER TABLE semo.knowledge_base
      ADD CONSTRAINT kb_scope_enum_chk CHECK (scope IN ('tenant-local', 'platform-global'));
  END IF;
  -- 128 과 동일한 무결성: tenant-local 행은 반드시 tenant_id 를 가진다.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kb_tenant_scope_chk'
      AND conrelid = 'semo.knowledge_base'::regclass
  ) THEN
    ALTER TABLE semo.knowledge_base
      ADD CONSTRAINT kb_tenant_scope_chk CHECK (scope = 'platform-global' OR tenant_id IS NOT NULL);
  END IF;
END $$;

-- tenant-local 조회/cascade 용 인덱스 (platform-global=NULL 행은 partial 로 제외 → 작고 빠름).
CREATE INDEX IF NOT EXISTS idx_kb_tenant
  ON semo.knowledge_base (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ============================================================
-- 2) gateway_credentials: per-tenant bearer 자격증명 (107_agent_service_credentials 미러)
--    게이트웨이가 DB 를 보는 유일한 주체이므로, 외부 Colony 인증의 SoT.
-- ============================================================
CREATE TABLE IF NOT EXISTS semo.gateway_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_slug    TEXT NOT NULL,                       -- 도메인 t-{slug} 파생용 비정규화
  token_hash     TEXT NOT NULL UNIQUE,                -- sha256(token) — 평문은 저장 안 함
  token_prefix   TEXT NOT NULL,                       -- 식별용 접두(sck_{slug}_xxxxx)
  scopes         TEXT[] NOT NULL DEFAULT ARRAY['kb:read','kb:write','persona:read'],
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  last_used_at   TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  revoked_reason TEXT,
  issued_by      TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gateway_credentials_tenant
  ON semo.gateway_credentials (tenant_id, status);

-- 회전(rotate) 시 활성 자격증명을 빠르게 찾기 위한 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_gateway_credentials_active
  ON semo.gateway_credentials (tenant_slug)
  WHERE status = 'active';
