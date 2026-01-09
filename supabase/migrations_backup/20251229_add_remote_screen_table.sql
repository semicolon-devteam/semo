-- =============================================================================
-- remote_screen: 세션당 단일 화면 내용 (UPSERT 최적화)
-- =============================================================================
-- remote_outputs 테이블은 라인별 기록이라 스피너/프롬프트 중복 문제 발생
-- remote_screen은 세션당 단일 레코드로 전체 화면을 UPSERT

CREATE TABLE IF NOT EXISTS remote_screen (
    session_id UUID PRIMARY KEY REFERENCES remote_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 인덱스 (session_id가 PK이므로 추가 인덱스 불필요)

-- RLS 정책
ALTER TABLE remote_screen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view screen of their sessions"
    ON remote_screen FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM remote_sessions
            WHERE remote_sessions.id = remote_screen.session_id
            AND remote_sessions.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert screen to their sessions"
    ON remote_screen FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM remote_sessions
            WHERE remote_sessions.id = remote_screen.session_id
            AND remote_sessions.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update screen of their sessions"
    ON remote_screen FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM remote_sessions
            WHERE remote_sessions.id = remote_screen.session_id
            AND remote_sessions.user_id = auth.uid()
        )
    );
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE remote_screen;
