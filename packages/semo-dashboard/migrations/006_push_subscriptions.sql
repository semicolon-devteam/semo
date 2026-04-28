-- SEMO Call Phase A3 — Web Push subscriptions
-- 사용자 디바이스(브라우저)별 push endpoint 보관. multi-device 지원.

CREATE TABLE IF NOT EXISTS dashboard_push_subscriptions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  device_label  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  failed_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dashboard_push_subscriptions_user
  ON dashboard_push_subscriptions (user_id);
