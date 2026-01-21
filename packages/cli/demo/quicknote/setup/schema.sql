-- QuickNote Demo Schema
-- SEMO Greenfield 워크플로우 시연용

-- ============================================================================
-- 1. Notes 테이블
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at_trigger ON notes;
CREATE TRIGGER notes_updated_at_trigger
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

-- ============================================================================
-- 2. RPC Functions
-- ============================================================================

-- 노트 목록 조회
CREATE OR REPLACE FUNCTION get_notes()
RETURNS SETOF notes AS $$
  SELECT * FROM notes ORDER BY updated_at DESC;
$$ LANGUAGE sql STABLE;

-- 노트 상세 조회
CREATE OR REPLACE FUNCTION get_note(p_id UUID)
RETURNS notes AS $$
  SELECT * FROM notes WHERE id = p_id;
$$ LANGUAGE sql STABLE;

-- 노트 생성
CREATE OR REPLACE FUNCTION create_note(
  p_title VARCHAR(100),
  p_content TEXT DEFAULT NULL
)
RETURNS notes AS $$
  INSERT INTO notes (title, content)
  VALUES (p_title, p_content)
  RETURNING *;
$$ LANGUAGE sql VOLATILE;

-- 노트 수정
CREATE OR REPLACE FUNCTION update_note(
  p_id UUID,
  p_title VARCHAR(100),
  p_content TEXT DEFAULT NULL
)
RETURNS notes AS $$
  UPDATE notes
  SET title = p_title, content = p_content
  WHERE id = p_id
  RETURNING *;
$$ LANGUAGE sql VOLATILE;

-- 노트 삭제
CREATE OR REPLACE FUNCTION delete_note(p_id UUID)
RETURNS VOID AS $$
  DELETE FROM notes WHERE id = p_id;
$$ LANGUAGE sql VOLATILE;

-- ============================================================================
-- 3. Row Level Security (RLS)
-- ============================================================================

-- RLS 활성화 (Supabase 권장)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능 (데모용 - 실제 환경에서는 인증 필요)
CREATE POLICY "Allow all operations on notes" ON notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 완료
-- ============================================================================

COMMENT ON TABLE notes IS 'QuickNote 데모 - 간단한 노트 테이블';
COMMENT ON FUNCTION get_notes() IS '모든 노트 조회 (수정일 내림차순)';
COMMENT ON FUNCTION get_note(UUID) IS '특정 노트 조회';
COMMENT ON FUNCTION create_note(VARCHAR, TEXT) IS '새 노트 생성';
COMMENT ON FUNCTION update_note(UUID, VARCHAR, TEXT) IS '노트 수정';
COMMENT ON FUNCTION delete_note(UUID) IS '노트 삭제';
