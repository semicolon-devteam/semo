-- =============================================================================
-- SEMO Office - Workflow Definitions Extension
-- =============================================================================
--
-- 기존 workflow_definitions 테이블을 확장하여 SEMO 워크플로우 지원
-- 6개 시스템 워크플로우: release, quality-gate, generate-spec, ideate, meta, code-complete
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- workflow_definitions 테이블 확장
-- -----------------------------------------------------------------------------

-- 워크플로우 타입 추가
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(20) DEFAULT 'sequential'
  CHECK (workflow_type IN (
    'sequential',    -- 순차 실행
    'parallel',      -- 병렬 실행
    'conditional'    -- 조건부 분기
  ));

-- 트리거 조건 추가 (자동 실행용)
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS triggers JSONB DEFAULT '[]'::jsonb;
-- 예: [
--   {"type": "file_change", "patterns": ["semo-system/**"]},
--   {"type": "command", "patterns": ["/release"]},
--   {"type": "event", "patterns": ["pr_merged"]}
-- ]

-- 입력 스키마 추가
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS input_schema JSONB DEFAULT '{}'::jsonb;

-- 출력 스키마 추가
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS output_schema JSONB DEFAULT '{}'::jsonb;

-- 시스템 워크플로우 여부
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- 패키지 정보 (소속)
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS package VARCHAR(50) DEFAULT 'custom';

-- 버전 정보
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0';

-- office_id NULL 허용 (글로벌 워크플로우)
ALTER TABLE workflow_definitions
  ALTER COLUMN office_id DROP NOT NULL;

-- 기존 제약조건 수정 (글로벌 워크플로우 허용)
ALTER TABLE workflow_definitions
  DROP CONSTRAINT IF EXISTS workflow_definitions_office_id_name_key;

ALTER TABLE workflow_definitions
  ADD CONSTRAINT workflow_definitions_name_office_unique
  UNIQUE NULLS NOT DISTINCT (name, office_id);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_type ON workflow_definitions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_system ON workflow_definitions(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_package ON workflow_definitions(package);

-- GIN 인덱스 (트리거 검색용)
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_triggers_gin ON workflow_definitions USING GIN(triggers);

-- Realtime 활성화 (이미 있을 수 있으므로 무시)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_definitions;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- steps JSONB 확장 구조
-- -----------------------------------------------------------------------------
-- 기존: [{"name": "...", "agent": "...", "description": "..."}]
-- 확장: [
--   {
--     "name": "lint",
--     "order": 1,
--     "skill": "quality-gate",           -- 스킬 이름 (agent 대신 또는 함께)
--     "agent": "qa",                      -- 선택적: 담당 에이전트
--     "description": "코드 린트 검사",
--     "required_skills": ["eslint"],      -- 필수 스킬
--     "optional_skills": [],              -- 선택 스킬
--     "input_schema": {},                 -- 단계 입력
--     "output_schema": {},                -- 단계 출력
--     "timeout_minutes": 10,              -- 타임아웃
--     "retry_policy": {                   -- 재시도 정책
--       "max_attempts": 3,
--       "backoff": "exponential"
--     },
--     "condition": {                      -- 조건부 실행
--       "type": "success",                -- 이전 단계 성공 시
--       "skip_on_error": false
--     }
--   }
-- ]

-- -----------------------------------------------------------------------------
-- 함수: 워크플로우 검색 (트리거 기반)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_workflow_by_trigger(
  p_trigger_type VARCHAR(20),
  p_pattern TEXT,
  p_office_id UUID DEFAULT NULL
)
RETURNS TABLE (
  workflow_id UUID,
  workflow_name VARCHAR(100),
  workflow_type VARCHAR(20),
  match_pattern TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wd.id AS workflow_id,
    wd.name AS workflow_name,
    wd.workflow_type,
    pattern::TEXT AS match_pattern
  FROM workflow_definitions wd,
    jsonb_array_elements(wd.triggers) AS trigger_item,
    jsonb_array_elements_text(trigger_item->'patterns') AS pattern
  WHERE wd.is_active = true
    AND (wd.office_id IS NULL OR wd.office_id = p_office_id)
    AND trigger_item->>'type' = p_trigger_type
    AND p_pattern ILIKE '%' || pattern || '%'
  ORDER BY
    CASE WHEN wd.office_id IS NOT NULL THEN 0 ELSE 1 END,  -- 오피스 워크플로우 우선
    wd.name;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 함수: 워크플로우 단계 조회
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_workflow_steps(
  p_workflow_name VARCHAR(100)
)
RETURNS TABLE (
  step_order INT,
  step_name TEXT,
  skill_name TEXT,
  agent_name TEXT,
  description TEXT,
  timeout_minutes INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((step->>'order')::INT, row_number() OVER ()::INT) AS step_order,
    step->>'name' AS step_name,
    step->>'skill' AS skill_name,
    step->>'agent' AS agent_name,
    step->>'description' AS description,
    COALESCE((step->>'timeout_minutes')::INT, 30) AS timeout_minutes
  FROM workflow_definitions wd,
    jsonb_array_elements(wd.steps) AS step
  WHERE wd.name = p_workflow_name
    AND wd.is_active = true
  ORDER BY step_order;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 뷰: 워크플로우 개요
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW workflow_overview AS
SELECT
  wd.id,
  wd.name,
  wd.description,
  wd.workflow_type,
  wd.package,
  wd.is_system,
  wd.is_active,
  jsonb_array_length(wd.steps) AS step_count,
  (
    SELECT jsonb_agg(step->>'name' ORDER BY (step->>'order')::int NULLS LAST)
    FROM jsonb_array_elements(wd.steps) AS step
  ) AS step_names,
  wd.office_id
FROM workflow_definitions wd
WHERE wd.is_active = true;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'workflow_definitions 테이블 확장 완료';
  RAISE NOTICE '- workflow_type 컬럼 추가 (sequential/parallel/conditional)';
  RAISE NOTICE '- triggers 컬럼 추가 (자동 실행 조건)';
  RAISE NOTICE '- is_system, package, version 컬럼 추가';
  RAISE NOTICE '- 글로벌 워크플로우 지원 (office_id NULL 허용)';
  RAISE NOTICE '- 트리거 검색 함수 생성됨';
END;
$$;
