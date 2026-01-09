-- =============================================================================
-- push_subscriptions: Web Push 구독 정보 저장
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 인덱스
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
-- RLS 정책
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);
-- Service Role이 모든 구독에 접근 가능하도록 (Edge Function에서 푸시 발송용)
CREATE POLICY "Service role can access all subscriptions"
    ON push_subscriptions FOR ALL
    USING (true)
    WITH CHECK (true);
