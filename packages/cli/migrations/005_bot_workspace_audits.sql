-- Bot Workspace Audits
-- 봇 워크스페이스 표준 구조 compliance 감사 결과 저장

CREATE TABLE IF NOT EXISTS semo.bot_workspace_audits (
  id          BIGSERIAL PRIMARY KEY,
  bot_id      TEXT NOT NULL,
  run_id      TEXT NOT NULL,
  rating      TEXT NOT NULL,           -- 'GOOD' | 'NEEDS-WORK' | 'POOR'
  score       INT NOT NULL DEFAULT 0,  -- 0-100
  checks      JSONB NOT NULL,          -- [{ name, passed, detail }]
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bwa_bot_id ON semo.bot_workspace_audits(bot_id);
CREATE INDEX IF NOT EXISTS idx_bwa_run_id ON semo.bot_workspace_audits(run_id);
CREATE INDEX IF NOT EXISTS idx_bwa_created_at ON semo.bot_workspace_audits(created_at DESC);
