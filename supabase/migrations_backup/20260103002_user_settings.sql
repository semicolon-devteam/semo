-- =============================================================================
-- user_settings: 유저별 설정 테이블
-- Full Auto Accept 등 전역 설정 저장
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_auto_accept BOOLEAN DEFAULT false,  -- Full Auto Accept 전역 설정
  settings_json JSONB DEFAULT '{}',          -- 확장 가능한 추가 설정
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
-- RLS 정책: 본인 설정만 관리 가능
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
