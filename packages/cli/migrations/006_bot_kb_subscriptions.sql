-- 006: Bot KB Subscriptions
-- 봇별 KB 도메인 구독 + 변경 다이제스트 워터마크

CREATE TABLE IF NOT EXISTS semo.bot_kb_subscriptions (
  bot_id VARCHAR(50) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bot_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_bot_kb_subs_bot_id
  ON semo.bot_kb_subscriptions(bot_id);

-- Seed: 봇별 구독 도메인
INSERT INTO semo.bot_kb_subscriptions (bot_id, domain) VALUES
  ('semiclaw', 'team'), ('semiclaw', 'project'), ('semiclaw', 'decision'), ('semiclaw', 'process'), ('semiclaw', 'infra'),
  ('workclaw', 'team'), ('workclaw', 'project'), ('workclaw', 'decision'), ('workclaw', 'process'),
  ('reviewclaw', 'team'), ('reviewclaw', 'project'), ('reviewclaw', 'decision'),
  ('planclaw', 'team'), ('planclaw', 'project'), ('planclaw', 'decision'), ('planclaw', 'process'),
  ('designclaw', 'team'), ('designclaw', 'project'), ('designclaw', 'decision'),
  ('infraclaw', 'team'), ('infraclaw', 'infra'), ('infraclaw', 'decision'),
  ('growthclaw', 'team'), ('growthclaw', 'project'), ('growthclaw', 'decision')
ON CONFLICT DO NOTHING;
