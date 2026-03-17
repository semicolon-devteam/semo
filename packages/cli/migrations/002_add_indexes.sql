-- 002_add_indexes.sql
-- P1-2: 누락된 성능 인덱스 추가

-- bot_status.status 필터용
CREATE INDEX IF NOT EXISTS idx_bot_status_status ON semo.bot_status(status);

-- bot_query_logs 조회 최적화
CREATE INDEX IF NOT EXISTS idx_bql_bot_id ON semo.bot_query_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bql_user_id ON semo.bot_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bql_created_at ON semo.bot_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bql_channel_id ON semo.bot_query_logs(channel_id);
