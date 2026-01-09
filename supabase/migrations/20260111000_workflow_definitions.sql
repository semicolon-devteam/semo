-- =============================================================================
-- SEMO Office - Workflow Definitions Table
-- =============================================================================
-- Order Zone Command Panel에서 사용하는 워크플로우 정의 테이블
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. workflow_definitions 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Office 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- 워크플로우 기본 정보
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 워크플로우 단계 정의 (JSONB 배열)
  -- 예: [{"name": "brainstorming", "agent": "Researcher"}, {"name": "design", "agent": "Designer"}]
  steps JSONB NOT NULL DEFAULT '[]',

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Office 내에서 워크플로우 이름은 유일해야 함
  UNIQUE(office_id, name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_office_id
  ON workflow_definitions(office_id);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_is_active
  ON workflow_definitions(is_active);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_workflow_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_definitions_updated_at();

-- RLS 정책
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "workflow_definitions_read_all" ON workflow_definitions;
DROP POLICY IF EXISTS "workflow_definitions_write_all" ON workflow_definitions;

-- 모든 사용자가 읽기 가능
CREATE POLICY "workflow_definitions_read_all" ON workflow_definitions
  FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (추후 인증 추가 시 수정)
CREATE POLICY "workflow_definitions_write_all" ON workflow_definitions
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 2. 샘플 워크플로우 데이터 삽입
-- -----------------------------------------------------------------------------

-- demo 오피스의 ID를 찾아서 샘플 데이터 삽입
DO $$
DECLARE
  demo_office_id UUID;
BEGIN
  -- demo 오피스 ID 조회
  SELECT id INTO demo_office_id FROM offices WHERE name = 'Demo Office' LIMIT 1;

  -- demo 오피스가 존재하면 샘플 워크플로우 삽입
  IF demo_office_id IS NOT NULL THEN
    -- Feature Request 워크플로우
    INSERT INTO workflow_definitions (office_id, name, description, steps)
    VALUES (
      demo_office_id,
      'Feature Request',
      '새로운 기능 요청 처리',
      '[
        {"name": "brainstorming", "agent": "Researcher", "description": "아이디어 조사 및 분석"},
        {"name": "design", "agent": "Designer", "description": "UI/UX 설계"},
        {"name": "implementation", "agent": "FE", "description": "프론트엔드 구현"}
      ]'::jsonb
    )
    ON CONFLICT (office_id, name) DO UPDATE SET
      description = EXCLUDED.description,
      steps = EXCLUDED.steps,
      updated_at = now();

    -- Bug Fix 워크플로우
    INSERT INTO workflow_definitions (office_id, name, description, steps)
    VALUES (
      demo_office_id,
      'Bug Fix',
      '버그 수정 워크플로우',
      '[
        {"name": "analysis", "agent": "QA", "description": "버그 원인 분석"},
        {"name": "fix", "agent": "BE", "description": "백엔드 수정"},
        {"name": "test", "agent": "QA", "description": "수정 사항 테스트"}
      ]'::jsonb
    )
    ON CONFLICT (office_id, name) DO UPDATE SET
      description = EXCLUDED.description,
      steps = EXCLUDED.steps,
      updated_at = now();

    -- Refactoring 워크플로우
    INSERT INTO workflow_definitions (office_id, name, description, steps)
    VALUES (
      demo_office_id,
      'Refactoring',
      '코드 리팩토링',
      '[
        {"name": "review", "agent": "Architect", "description": "코드 리뷰 및 개선점 분석"},
        {"name": "refactor", "agent": "BE", "description": "코드 리팩토링 수행"},
        {"name": "test", "agent": "QA", "description": "리팩토링 후 테스트"}
      ]'::jsonb
    )
    ON CONFLICT (office_id, name) DO UPDATE SET
      description = EXCLUDED.description,
      steps = EXCLUDED.steps,
      updated_at = now();

    -- Full Stack Feature 워크플로우
    INSERT INTO workflow_definitions (office_id, name, description, steps)
    VALUES (
      demo_office_id,
      'Full Stack Feature',
      '풀스택 기능 개발 (FE + BE)',
      '[
        {"name": "planning", "agent": "Architect", "description": "아키텍처 설계"},
        {"name": "backend", "agent": "BE", "description": "백엔드 API 구현"},
        {"name": "frontend", "agent": "FE", "description": "프론트엔드 구현"},
        {"name": "integration", "agent": "QA", "description": "통합 테스트"}
      ]'::jsonb
    )
    ON CONFLICT (office_id, name) DO UPDATE SET
      description = EXCLUDED.description,
      steps = EXCLUDED.steps,
      updated_at = now();

    RAISE NOTICE 'Sample workflows inserted for Demo Office (ID: %)', demo_office_id;
  ELSE
    RAISE NOTICE 'Demo Office not found. Sample workflows not inserted.';
  END IF;
END $$;

-- 테이블 코멘트
COMMENT ON TABLE workflow_definitions IS 'Order Zone에서 선택 가능한 워크플로우 정의';
COMMENT ON COLUMN workflow_definitions.steps IS 'JSON 배열: [{name, agent, description}, ...]';
