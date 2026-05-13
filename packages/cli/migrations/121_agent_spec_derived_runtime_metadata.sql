-- 121_agent_spec_derived_runtime_metadata
--
-- AgentSpec projection metadata for derived/helper bots.
--
-- derived_from:
--   Canonical source bot for derived runtime sessions such as semiclaw-overflow.
--
-- reply_as:
--   Persona/bot id used when a derived runtime should reply as another bot.
--   Example: semiclaw-overflow has bot_id=semiclaw-overflow but reply_as=semiclaw.

BEGIN;

ALTER TABLE semo.bot_status
  ADD COLUMN IF NOT EXISTS derived_from TEXT REFERENCES semo.bot_status(bot_id),
  ADD COLUMN IF NOT EXISTS reply_as     TEXT REFERENCES semo.bot_status(bot_id);

COMMENT ON COLUMN semo.bot_status.derived_from IS
  'Source bot id for derived/helper runtime sessions rendered through AgentSpec.';

COMMENT ON COLUMN semo.bot_status.reply_as IS
  'Bot/persona id to use when a derived runtime replies externally.';

INSERT INTO semo.bot_status (
  bot_id,
  name,
  emoji,
  role,
  workspace_path,
  status,
  kb_domains,
  budget_per_message,
  slack_username,
  slack_icon_emoji,
  created_by_bot_id,
  template_bot_id,
  runtime_hint,
  tool_capabilities,
  projection_targets,
  derived_from,
  reply_as
)
SELECT
  'semiclaw-overflow',
  'SemiClaw Overflow',
  emoji,
  'Derived overflow worker for SemiClaw',
  REPLACE(workspace_path, 'semiclaw', 'semiclaw-overflow'),
  status,
  kb_domains,
  budget_per_message,
  slack_username,
  slack_icon_emoji,
  '__genesis__',
  'semiclaw',
  runtime_hint,
  tool_capabilities,
  projection_targets,
  'semiclaw',
  'semiclaw'
FROM semo.bot_status
WHERE bot_id = 'semiclaw'
ON CONFLICT (bot_id) DO UPDATE SET
  derived_from = EXCLUDED.derived_from,
  reply_as = EXCLUDED.reply_as,
  template_bot_id = COALESCE(semo.bot_status.template_bot_id, EXCLUDED.template_bot_id);

COMMIT;
