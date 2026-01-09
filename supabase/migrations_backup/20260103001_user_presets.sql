-- =============================================================================
-- user_presets: 유저별 프로젝트 프리셋 테이블
-- 빠른 프로젝트 이동 및 Claude Code 실행을 위한 프리셋
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- 프리셋 이름 (예: "SEMO Remote")
  project_path TEXT NOT NULL,            -- 프로젝트 경로
  run_claude BOOLEAN DEFAULT true,       -- Claude Code 자동 실행 여부
  sort_order INTEGER DEFAULT 0,          -- 정렬 순서
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)                  -- 유저별 프리셋 이름 중복 방지
);
-- RLS 활성화
ALTER TABLE user_presets ENABLE ROW LEVEL SECURITY;
-- RLS 정책: 본인 프리셋만 관리 가능
CREATE POLICY "Users can manage own presets" ON user_presets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_user_presets_updated_at
  BEFORE UPDATE ON user_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presets_updated_at();
-- 인덱스
CREATE INDEX idx_user_presets_user_id ON user_presets(user_id);
CREATE INDEX idx_user_presets_sort_order ON user_presets(user_id, sort_order);
