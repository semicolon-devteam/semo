-- Claude Code 컬럼 추가
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS is_claude_code BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE remote_sessions ADD COLUMN IF NOT EXISTS process_name TEXT;
