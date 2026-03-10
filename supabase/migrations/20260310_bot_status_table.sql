-- =============================================================================
-- SEMO - Bot Status Table
-- =============================================================================
--
-- 봇 상태 정보를 저장하는 테이블
-- /bots 페이지에서 봇 목록 및 상태 표시에 사용
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. bot_status 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS semo.bot_status (
  bot_id VARCHAR(255) PRIMARY KEY,
  bot_name VARCHAR(255) NOT NULL,
  emoji VARCHAR(50),
  role TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'error')),
  last_active_at TIMESTAMP WITH TIME ZONE,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE semo.bot_status IS '봇 상태 정보 저장';
COMMENT ON COLUMN semo.bot_status.bot_id IS 'Slack bot user ID (예: U0ADGB42N79)';
COMMENT ON COLUMN semo.bot_status.bot_name IS '봇 이름 (예: SemiClaw, WorkClaw)';
COMMENT ON COLUMN semo.bot_status.emoji IS '봇 이모지 (예: 🤖, 🛠️)';
COMMENT ON COLUMN semo.bot_status.role IS '봇 역할 설명';
COMMENT ON COLUMN semo.bot_status.status IS '봇 현재 상태 (active/idle/error)';
COMMENT ON COLUMN semo.bot_status.last_active_at IS '마지막 활동 시각';
COMMENT ON COLUMN semo.bot_status.session_count IS '현재 활성 세션 수';
COMMENT ON COLUMN semo.bot_status.created_at IS '레코드 생성 시각';
COMMENT ON COLUMN semo.bot_status.updated_at IS '레코드 수정 시각';

-- -----------------------------------------------------------------------------
-- 2. 인덱스 생성
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bot_status_last_active ON semo.bot_status (last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_status_status ON semo.bot_status (status);

-- -----------------------------------------------------------------------------
-- 3. updated_at 자동 업데이트 트리거
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION semo.update_bot_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bot_status_updated_at
  BEFORE UPDATE ON semo.bot_status
  FOR EACH ROW
  EXECUTE FUNCTION semo.update_bot_status_updated_at();
