-- 123_agent_spec_projection_skip_targets
--
-- Some bot_status rows are helper/runtime support identities, not full projected
-- OpenClaw/ClaudeCode personas. Keep the policy in bot_status instead of
-- hardcoding helper names in renderers.

BEGIN;

ALTER TABLE semo.bot_status
  ADD COLUMN IF NOT EXISTS is_helper BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS skip_projection_targets TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN semo.bot_status.is_helper IS
  'True for helper/support bot identities that should not be treated as full projected personas.';

COMMENT ON COLUMN semo.bot_status.skip_projection_targets IS
  'AgentSpec runtime targets to skip for this bot_id. Values: claude-code, codex-skill, openclaw.';

UPDATE semo.bot_status
SET is_helper = TRUE,
    skip_projection_targets = ARRAY['openclaw']
WHERE bot_id = 'kb-sidekick';

COMMIT;
