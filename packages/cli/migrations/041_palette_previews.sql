-- 041: Standalone palette preview storage (DesignClaw 독립 색상 상담용)

CREATE TABLE IF NOT EXISTS semo.palette_previews (
  preview_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  colors_json JSONB NOT NULL,       -- ColorGroup[]
  bot_id      TEXT NOT NULL DEFAULT 'designclaw',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_palette_previews_created
  ON semo.palette_previews (created_at DESC);
