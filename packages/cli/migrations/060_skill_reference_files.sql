-- 060: Skill reference files support
--
-- reference_files are stored in metadata JSONB: {"reference_files": {"filename.md": "content..."}}
-- No schema change needed — metadata is already JSONB.
-- This migration documents the convention.

COMMENT ON COLUMN semo.skill_definitions.metadata IS
  'JSONB: bot_ids (text[]), reference_files ({filename: content} map, optional)';
