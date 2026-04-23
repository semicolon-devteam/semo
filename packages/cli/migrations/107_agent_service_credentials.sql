-- 107: agent service credentials (PAT vault)
-- SEMO를 중앙 발급/검증자로 하는 Personal Access Token 저장소.
-- 관련 결정: `semicolon decision agent-authenticated-action-standard`

BEGIN;

CREATE TABLE IF NOT EXISTS semo.agent_service_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id           TEXT NOT NULL,
  service_domain   TEXT NOT NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  token_prefix     TEXT NOT NULL,
  scopes           TEXT[] NOT NULL DEFAULT '{}',
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  last_used_at     TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revoked_reason   TEXT,
  issued_by        TEXT NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT chk_token_hash_format
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_token_prefix_format
    CHECK (token_prefix ~ '^semo_pat_(live|test)_[a-z0-9_-]+_$'),
  CONSTRAINT chk_revoke_consistency
    CHECK (revoked_reason IS NULL OR revoked_at IS NOT NULL),
  CONSTRAINT chk_expires_after_issued
    CHECK (expires_at IS NULL OR expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_agent_creds_bot_id
  ON semo.agent_service_credentials (bot_id);

CREATE INDEX IF NOT EXISTS idx_agent_creds_service
  ON semo.agent_service_credentials (service_domain);

CREATE INDEX IF NOT EXISTS idx_agent_creds_active
  ON semo.agent_service_credentials (bot_id, service_domain)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_creds_expires
  ON semo.agent_service_credentials (expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

CREATE OR REPLACE VIEW semo.v_agent_credentials_audit AS
SELECT
  id,
  bot_id,
  service_domain,
  token_prefix,
  scopes,
  issued_at,
  expires_at,
  last_used_at,
  revoked_at,
  revoked_reason,
  issued_by,
  CASE
    WHEN revoked_at IS NOT NULL THEN 'revoked'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
    ELSE 'active'
  END AS status,
  metadata
FROM semo.agent_service_credentials;

COMMENT ON TABLE semo.agent_service_credentials IS
  'PAT vault for agent→service authenticated writes. Plaintext never stored — only HMAC-SHA256(pepper, plaintext) hex. See decision: agent-authenticated-action-standard.';

COMMENT ON COLUMN semo.agent_service_credentials.token_hash IS
  '64-char lowercase hex of HMAC-SHA256(SEMO_CREDENTIAL_PEPPER, plaintext). Unique globally.';

COMMENT ON COLUMN semo.agent_service_credentials.token_prefix IS
  'Deterministic prefix ending in underscore (e.g. "semo_pat_live_workclaw_"). Safe to expose to services for audit logging.';

COMMENT ON COLUMN semo.agent_service_credentials.scopes IS
  'Format "{resource}:{action}" (e.g. ["board:write","kpi:read"]). Wildcard "resource:*" supported in verify.';

COMMIT;
