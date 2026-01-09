-- =============================================================================
-- remote_screen: 서비스 접근 정책 추가
-- =============================================================================
-- iterm_streamer.py가 anon key로 화면 내용을 UPSERT할 수 있도록
-- 세션이 존재하면 INSERT/UPDATE 허용 (세션 소유자 확인 없이)

-- 기존 정책 삭제 (안전하게)
DROP POLICY IF EXISTS "Users can insert screen to their sessions" ON remote_screen;
DROP POLICY IF EXISTS "Users can update screen of their sessions" ON remote_screen;
-- 세션이 존재하면 INSERT 허용 (streamer가 사용)
CREATE POLICY "Allow insert if session exists"
    ON remote_screen FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM remote_sessions
            WHERE remote_sessions.id = remote_screen.session_id
        )
    );
-- 세션이 존재하면 UPDATE 허용 (streamer가 사용)
CREATE POLICY "Allow update if session exists"
    ON remote_screen FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM remote_sessions
            WHERE remote_sessions.id = remote_screen.session_id
        )
    );
