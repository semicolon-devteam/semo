CREATE TABLE IF NOT EXISTS semo.bot_cost_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id        TEXT        NOT NULL,
  cost_usd      NUMERIC(10,6) NOT NULL,
  service_id    TEXT,
  model         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_cost_log_created ON semo.bot_cost_log (created_at);
CREATE INDEX IF NOT EXISTS idx_bot_cost_log_bot_day ON semo.bot_cost_log (bot_id, created_at);
