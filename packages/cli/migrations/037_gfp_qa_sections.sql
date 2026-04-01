-- GFP Phase 3 Q&A support: structured clarification questions
-- qa_items stores Q&A items as JSONB array
-- slack_thread_ts tracks Slack thread for answer collection

ALTER TABLE semo.gfp_phase_sections
  ADD COLUMN IF NOT EXISTS qa_items JSONB,
  ADD COLUMN IF NOT EXISTS slack_thread_ts VARCHAR(50);

COMMENT ON COLUMN semo.gfp_phase_sections.qa_items IS
  'Structured Q&A items for clarification sections. Array of {id, question, sub_bullets[], answer, answered_at, answered_via}';

COMMENT ON COLUMN semo.gfp_phase_sections.slack_thread_ts IS
  'Slack thread timestamp for Q&A answer collection via threaded replies';
