-- SEMO Dashboard v5 — Customer channel integration (appdb / public 스키마)
--
-- 고객 테넌트가 자신의 외부 메신저/이메일 채널(슬랙·카카오·텔레그램·디스코드·이메일·라인·인스타그램)을
-- 연결해 SEMO 에이전트가 송수신할 수 있도록 하는 provider-neutral 스키마.
--
-- 보안 강화 (Codex review):
--   • credentials_ref 는 AES-256-GCM 으로 암호화된 JSON({iv, tag, ciphertext}) 만 저장.
--     평문 토큰 저장 금지 (운영). 개발/테스트 fixture 는 마커만 둔다.
--   • token_expires_at 은 평문 컬럼으로 분리 — refresh 잡이 복호화 없이 만료 검사를 한다.
--   • credentials_key_id 는 미래 KMS 키 분리 대비.
--   • outbound_enabled 기본 false — 봇 런타임이 준비된 채널만 송신 허용.
--   • oauth_states 는 DB-backed one-time consume (서버 메모리 / Redis 의 race condition 방지).
--     state_hash = HMAC-SHA256(raw_state) 만 저장 — raw state 는 클라이언트 쿠키에만.
--
-- 010 의 아키텍처(appdb public, Supabase FK 없음, RLS 미사용, WHERE tenant_id 격리)를 그대로 따른다.
-- 적용: scripts/apply-customer-tables.mjs 또는 SQL Editor. 멱등.

BEGIN;

-- ─── ensureTenantForUser race-safe lookup ──────────────────────────────────
-- public.tenants.owner_user_id 는 010 에서 일반 컬럼으로 추가됨(논리 FK).
-- 동일 owner_user_id 에 대한 중복 personal tenant 생성을 막기 위한 partial UNIQUE.
-- NULL(미할당 system tenant 등)은 충돌 검사에서 제외.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenants_owner_user
  ON public.tenants(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- ─── tenant_channels: 테넌트가 연결한 외부 채널 ────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_channels (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_type            text NOT NULL
                            CHECK (channel_type IN ('slack','kakao','telegram','discord','email','line','instagram')),
  external_workspace_id   text NOT NULL,            -- Slack team_id, Kakao Channel ID, Telegram chat_id 등
  external_team_name      text,                     -- 표시용 (Slack workspace name 등)
  credentials_ref         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- AES-256-GCM 암호화: {iv, tag, ciphertext}
  token_expires_at        timestamptz,              -- 평문 — refresh 잡이 복호화 없이 검사
  credentials_key_id      text,                     -- 미래 KMS 키 식별 (현재 NULL = 환경변수 키)
  last_refresh_error      text,                     -- 마지막 refresh 실패 사유
  last_seen_at            timestamptz,              -- 마지막 이벤트 수신 시각
  outbound_enabled        boolean NOT NULL DEFAULT false,  -- Codex: 송신은 기본 OFF, 런타임 준비 후 ON
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','paused','revoked','error')),
  connected_by_user_id    uuid,                     -- Supabase auth id (논리 참조)
  revoked_by_user_id      uuid,
  revoked_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel_type, external_workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_channels_tenant_status
  ON public.tenant_channels(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_channels_type_workspace
  ON public.tenant_channels(channel_type, external_workspace_id);

-- ─── channel_messages: 외부 채널 in/out 메시지 로그 + dedup ────────────────
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_channel_id    uuid NOT NULL REFERENCES public.tenant_channels(id) ON DELETE CASCADE,
  direction            text NOT NULL CHECK (direction IN ('inbound','outbound')),
  external_message_id  text NOT NULL,               -- dedup 키 (Slack ts, Kakao event id 등)
  external_channel_id  text,                        -- Slack channel_id, Kakao chat_id 등
  external_user_id     text,                        -- 발신자 ID (외부 시스템 기준)
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_install_id     uuid REFERENCES public.agent_installs(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'received'
                         CHECK (status IN ('received','dispatching','responded','failed','ignored')),
  error                text,
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  -- Slack/Kakao 재시도(at-least-once) 중복 방지: 동일 채널·방향·외부메시지ID 는 1행만.
  UNIQUE(tenant_channel_id, direction, external_message_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_occurred
  ON public.channel_messages(tenant_channel_id, occurred_at DESC);

-- ─── oauth_states: DB-backed one-time consume (Codex) ──────────────────────
-- 메모리/쿠키만 사용하면 멀티-프로세스 환경에서 race condition + replay 위험.
-- state_hash = HMAC-SHA256(raw_state, server_secret) 만 저장하고,
-- 콜백에서 `UPDATE … WHERE consumed_at IS NULL RETURNING …` 로 원자적 1회 소비.
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state_hash    text PRIMARY KEY,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid,                               -- Supabase auth id (논리 참조)
  channel_type  text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb, -- {redirect_after, scopes, ...}
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,                        -- NULL = 아직 소비 안 됨
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON public.oauth_states(expires_at);

-- ─── updated_at 자동 갱신 트리거 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_channels_touch ON public.tenant_channels;
CREATE TRIGGER trg_tenant_channels_touch
  BEFORE UPDATE ON public.tenant_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
