-- =============================================================================
-- SEMO Office - Skill Definitions Table
-- =============================================================================
--
-- 67개 SEMO 스킬을 DB 기반으로 관리하기 위한 테이블
-- custom_skills는 오피스별 커스텀 스킬, skill_definitions는 시스템 스킬
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- skill_definitions: 시스템 스킬 정의 (SEMO 스킬 저장)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS skill_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보 (YAML frontmatter 대응)
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,

  -- 분류
  package VARCHAR(50) NOT NULL DEFAULT 'custom',  -- 'semo-skills', 'meta', 'office', 'custom'
  category VARCHAR(50),  -- 'code', 'test', 'git', 'notify', 'query', 'db', 'doc', 'project', 'workflow'

  -- 타입 구분 (Skill vs Workflow)
  skill_type VARCHAR(20) DEFAULT 'skill' CHECK (skill_type IN (
    'skill',     -- 단순 스킬 (Stateless)
    'workflow'   -- 다단계 프로세스 (Stateful)
  )),

  -- 실행 설정
  tools TEXT[] DEFAULT '{}',  -- ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'GitHub CLI']
  model VARCHAR(20) DEFAULT 'inherit',  -- 'inherit', 'opus', 'sonnet', 'haiku'

  -- 트리거 조건 (JSONB)
  triggers JSONB DEFAULT '[]'::jsonb,
  -- 예: [
  --   {"type": "keyword", "patterns": ["코드 작성해줘", "구현해줘"]},
  --   {"type": "file", "patterns": ["*.ts", "*.tsx"]},
  --   {"type": "command", "patterns": ["/write-code"]}
  -- ]

  -- 스킬 프롬프트 (SKILL.md 본문)
  prompt TEXT NOT NULL,

  -- 입출력 스키마
  input_schema JSONB DEFAULT '{}'::jsonb,
  output_schema JSONB DEFAULT '{}'::jsonb,

  -- 참조 문서 (references/ 폴더 내용)
  reference_docs JSONB DEFAULT '{}'::jsonb,
  -- 예: {
  --   "memory-schema.md": "...(내용)...",
  --   "memory-sync.md": "...(내용)..."
  -- }

  -- 관계
  related_skills TEXT[] DEFAULT '{}',
  depends_on TEXT[] DEFAULT '{}',  -- 의존 스킬

  -- 워크플로우 전용 (skill_type = 'workflow' 일 때만 사용)
  workflow_steps JSONB DEFAULT '[]'::jsonb,
  -- 예: [
  --   {"name": "lint", "skill": "quality-gate", "order": 1},
  --   {"name": "test", "skill": "run-tests", "order": 2}
  -- ]

  -- 메타데이터
  version VARCHAR(20) DEFAULT '1.0.0',
  is_system BOOLEAN DEFAULT false,  -- 시스템 스킬 여부 (수정 불가)
  is_active BOOLEAN DEFAULT true,

  -- 오피스 연결 (NULL이면 글로벌)
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약: 글로벌 스킬은 이름 유일, 오피스별 스킬은 오피스 내에서 유일
  CONSTRAINT skill_definitions_name_office_unique UNIQUE NULLS NOT DISTINCT (name, office_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_skill_definitions_name ON skill_definitions(name);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_package ON skill_definitions(package);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_category ON skill_definitions(category);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_type ON skill_definitions(skill_type);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_office ON skill_definitions(office_id);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_active ON skill_definitions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_skill_definitions_system ON skill_definitions(is_system) WHERE is_system = true;

-- GIN 인덱스 (JSONB 검색용)
CREATE INDEX IF NOT EXISTS idx_skill_definitions_triggers_gin ON skill_definitions USING GIN(triggers);
CREATE INDEX IF NOT EXISTS idx_skill_definitions_tools_gin ON skill_definitions USING GIN(tools);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_skill_definitions_updated_at ON skill_definitions;
CREATE TRIGGER trigger_skill_definitions_updated_at
  BEFORE UPDATE ON skill_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE skill_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_definitions_service_policy ON skill_definitions
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE skill_definitions;

-- -----------------------------------------------------------------------------
-- 함수: 스킬 검색 (트리거 기반)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_skill_by_trigger(
  p_input TEXT,
  p_office_id UUID DEFAULT NULL
)
RETURNS TABLE (
  skill_id UUID,
  skill_name VARCHAR(100),
  match_type VARCHAR(20),
  match_pattern TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id AS skill_id,
    sd.name AS skill_name,
    (trigger_item->>'type')::VARCHAR(20) AS match_type,
    pattern::TEXT AS match_pattern
  FROM skill_definitions sd,
    jsonb_array_elements(sd.triggers) AS trigger_item,
    jsonb_array_elements_text(trigger_item->'patterns') AS pattern
  WHERE sd.is_active = true
    AND (sd.office_id IS NULL OR sd.office_id = p_office_id)
    AND p_input ILIKE '%' || pattern || '%'
  ORDER BY
    CASE WHEN sd.office_id IS NOT NULL THEN 0 ELSE 1 END,  -- 오피스 스킬 우선
    sd.name;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 함수: 스킬 의존성 확인
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_skill_dependencies(
  p_skill_name VARCHAR(100)
)
RETURNS TABLE (
  skill_name VARCHAR(100),
  dependency_name TEXT,
  dependency_level INT
) AS $$
WITH RECURSIVE skill_deps AS (
  -- 시작점
  SELECT
    sd.name AS skill_name,
    unnest(sd.depends_on) AS dependency_name,
    1 AS dependency_level
  FROM skill_definitions sd
  WHERE sd.name = p_skill_name

  UNION ALL

  -- 재귀
  SELECT
    sd.name,
    unnest(sd.depends_on),
    deps.dependency_level + 1
  FROM skill_definitions sd
  INNER JOIN skill_deps deps ON sd.name = deps.dependency_name
  WHERE deps.dependency_level < 10  -- 최대 깊이 제한
)
SELECT * FROM skill_deps;
$$ LANGUAGE SQL;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'skill_definitions 테이블 생성 완료';
  RAISE NOTICE '- 55개 Skill + 6개 Workflow 저장 준비됨';
  RAISE NOTICE '- 트리거 기반 스킬 검색 함수 생성됨';
  RAISE NOTICE '- 의존성 확인 함수 생성됨';
END;
$$;
