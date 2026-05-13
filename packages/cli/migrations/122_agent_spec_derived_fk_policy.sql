-- 122_agent_spec_derived_fk_policy
--
-- Derived/helper bot references must not block retirement/deletion of a source bot.
-- If the source disappears, the derived runtime falls back to its own identity.

BEGIN;

ALTER TABLE semo.bot_status
  DROP CONSTRAINT IF EXISTS bot_status_derived_from_fkey,
  DROP CONSTRAINT IF EXISTS bot_status_reply_as_fkey;

ALTER TABLE semo.bot_status
  ADD CONSTRAINT bot_status_derived_from_fkey
    FOREIGN KEY (derived_from) REFERENCES semo.bot_status(bot_id) ON DELETE SET NULL,
  ADD CONSTRAINT bot_status_reply_as_fkey
    FOREIGN KEY (reply_as) REFERENCES semo.bot_status(bot_id) ON DELETE SET NULL;

COMMIT;
