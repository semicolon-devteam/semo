-- 062: Bot Slack Profiles — KB slack-config 엔트리 시딩
-- 각 봇의 Slack 표시 정체성(username, icon_emoji)을 KB에 저장.
-- channel-slack, orchestrator, dashboard가 런타임에 이 데이터를 조회하여
-- chat:write.customize로 봇 정체성을 표시한다.

INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
VALUES
  ('semiclaw',   'slack-config', '', E'username: SemiClaw\nicon_emoji: \":clipboard:\"',                  '{}', 'migration-062'),
  ('planclaw',   'slack-config', '', E'username: PlanClaw\nicon_emoji: \":bar_chart:\"',                  '{}', 'migration-062'),
  ('designclaw', 'slack-config', '', E'username: DesignClaw\nicon_emoji: \":art:\"',                      '{}', 'migration-062'),
  ('workclaw',   'slack-config', '', E'username: WorkClaw\nicon_emoji: \":hammer_and_wrench:\"',          '{}', 'migration-062'),
  ('reviewclaw', 'slack-config', '', E'username: ReviewClaw\nicon_emoji: \":mag:\"',                      '{}', 'migration-062'),
  ('infraclaw',  'slack-config', '', E'username: InfraClaw\nicon_emoji: \":gear:\"',                      '{}', 'migration-062'),
  ('growthclaw', 'slack-config', '', E'username: GrowthClaw\nicon_emoji: \":chart_with_upwards_trend:\"', '{}', 'migration-062')
ON CONFLICT (domain, key, sub_key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now();

-- slack_config scheme의 value_hint 업데이트 (username, icon_emoji 필드 명시)
UPDATE semo.kb_type_schema
SET value_hint = 'YAML: username, icon_emoji, channels[]'
WHERE entity_type = 'bot' AND scheme_key = 'slack_config';
