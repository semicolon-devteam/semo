-- =============================================================================
-- Bot Query Logs - 유저 ↔ 봇 대화 로그
-- =============================================================================
--
-- 용도: 유저가 Slack 등에서 봇에게 질의한 내용과 응답을 기록
-- KB(knowledge_base)와 완전 분리 — 검색 품질에 영향 없음
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS semo.bot_query_logs (
  id          BIGSERIAL PRIMARY KEY,

  -- 누가
  bot_id      VARCHAR(50)  NOT NULL,          -- e.g. 'semiclaw', 'workclaw', 'planclaw'
  user_id     VARCHAR(100) NOT NULL,          -- Slack user ID (e.g. 'URSQYUNQJ')
  user_name   VARCHAR(100),                   -- display name (optional, for readability)

  -- 어디서
  channel     VARCHAR(50)  DEFAULT 'slack',   -- 'slack', 'discord', etc.
  channel_id  VARCHAR(100),                   -- Slack channel/DM ID
  thread_id   VARCHAR(100),                   -- thread timestamp (if threaded)

  -- 무엇을
  query       TEXT         NOT NULL,          -- 유저 질의 원문
  response    TEXT,                           -- 봇 응답 (NULL = 응답 실패)
  
  -- 메타
  model       VARCHAR(100),                   -- 사용된 모델 (e.g. 'claude-opus-4-6')
  latency_ms  INTEGER,                        -- 응답 시간 (ms)
  token_input INTEGER,                        -- 입력 토큰
  token_output INTEGER,                       -- 출력 토큰
  metadata    JSONB        DEFAULT '{}'::jsonb, -- 기타 (tools used, error info 등)
  
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bql_bot_id     ON semo.bot_query_logs (bot_id);
CREATE INDEX IF NOT EXISTS idx_bql_user_id    ON semo.bot_query_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_bql_created    ON semo.bot_query_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bql_channel    ON semo.bot_query_logs (channel_id);
CREATE INDEX IF NOT EXISTS idx_bql_query_trgm ON semo.bot_query_logs USING gin (query gin_trgm_ops);

-- 코멘트
COMMENT ON TABLE semo.bot_query_logs IS '유저 ↔ 봇 대화 로그. KB와 분리되어 검색 품질에 영향 없음.';
COMMENT ON COLUMN semo.bot_query_logs.bot_id IS '봇 식별자 (semiclaw, workclaw 등)';
COMMENT ON COLUMN semo.bot_query_logs.query IS '유저 질의 원문';
COMMENT ON COLUMN semo.bot_query_logs.response IS '봇 응답 원문. NULL이면 응답 실패';
