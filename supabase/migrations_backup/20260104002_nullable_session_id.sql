-- =============================================================================
-- remote_commands: session_id를 nullable로 변경
-- open_terminal 같은 브로드캐스트 명령은 특정 세션이 필요 없음
-- =============================================================================

-- 기존 외래 키 제약조건 삭제
ALTER TABLE remote_commands
DROP CONSTRAINT IF EXISTS remote_commands_session_id_fkey;
-- session_id 컬럼을 nullable로 변경
ALTER TABLE remote_commands
ALTER COLUMN session_id DROP NOT NULL;
-- 외래 키 재추가 (nullable 허용)
ALTER TABLE remote_commands
ADD CONSTRAINT remote_commands_session_id_fkey
FOREIGN KEY (session_id) REFERENCES remote_sessions(id) ON DELETE CASCADE;
