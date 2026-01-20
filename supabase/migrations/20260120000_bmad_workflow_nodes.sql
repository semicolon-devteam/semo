-- =============================================================================
-- SEMO - BMad Greenfield Workflow Tables
-- =============================================================================
--
-- BMad Method 기반 워크플로우 노드 시스템
-- - workflow_nodes: 노드 정의 (에이전트 + 스킬 조합)
-- - workflow_edges: 노드 간 연결
-- - workflow_node_executions: 노드별 실행 기록
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. workflow_definitions 테이블 확장
-- -----------------------------------------------------------------------------

-- 커맨드 이름 추가 (슬래시 커맨드 매핑)
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS command_name TEXT UNIQUE;

COMMENT ON COLUMN workflow_definitions.command_name IS 'Slash command 이름 (예: greenfield, brownfield)';

-- start_node_id는 workflow_nodes 생성 후 추가 (순환 참조 방지)

-- -----------------------------------------------------------------------------
-- 2. workflow_instances 테이블 확장
-- -----------------------------------------------------------------------------

-- 인스턴스 이름 추가 (사용자 지정 이름)
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS instance_name TEXT;

COMMENT ON COLUMN workflow_instances.instance_name IS '사용자 지정 인스턴스 이름 (예: 자동차 딜러 앱)';

-- current_node_id는 workflow_nodes 생성 후 추가

-- -----------------------------------------------------------------------------
-- 3. workflow_nodes 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 워크플로우 연결
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,

  -- 노드 기본 정보
  node_key TEXT NOT NULL,          -- "D0", "D1", "P1", "S1", "I5" 등 (진행도 표시용)
  name TEXT NOT NULL,              -- "Include Discovery?", "Ideate", "Write Code"
  description TEXT,

  -- 에이전트 + 스킬 조합
  agent_id UUID REFERENCES agent_definitions(id) ON DELETE SET NULL,
  skill_name TEXT,                 -- 스킬 이름 (예: 'ideate', 'write-code')

  -- 노드 유형
  node_type TEXT NOT NULL DEFAULT 'task' CHECK (node_type IN (
    'task',      -- 작업 노드 (에이전트가 스킬 실행)
    'decision',  -- 결정 노드 (사용자 선택)
    'gateway'    -- 게이트웨이 노드 (분기/합류)
  )),

  -- Decision 노드 설정
  decision_config JSONB,  -- {"question": "Has UI?", "options": ["yes", "no"]}

  -- BMad Phase 정보
  phase TEXT CHECK (phase IN (
    'discovery',      -- Phase 1: Discovery
    'planning',       -- Phase 2: Planning
    'solutioning',    -- Phase 3: Solutioning
    'implementation'  -- Phase 4: Implementation
  )),
  phase_order INT DEFAULT 0,  -- Phase 내 순서

  -- 시각화 위치
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 워크플로우 내에서 node_key는 유일
  UNIQUE(workflow_id, node_key)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type ON workflow_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_phase ON workflow_nodes(phase);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_agent ON workflow_nodes(agent_id);

COMMENT ON TABLE workflow_nodes IS 'BMad 워크플로우 노드 정의 (에이전트 + 스킬 조합)';
COMMENT ON COLUMN workflow_nodes.node_key IS '노드 키 (예: D0, P1, S1, I5) - 진행도 표시용';
COMMENT ON COLUMN workflow_nodes.decision_config IS 'Decision 노드 설정: {"question": "...", "options": [...]}';

-- -----------------------------------------------------------------------------
-- 4. workflow_edges 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 워크플로우 연결
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,

  -- 소스 → 타겟 연결
  source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,

  -- 조건 (Decision 노드에서 분기)
  condition TEXT,            -- "yes", "no", "pass", "fail", NULL
  condition_expression JSONB,
  priority INT DEFAULT 0,    -- 높을수록 우선 평가

  -- 라벨
  label TEXT,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow ON workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow_edges(target_node_id);

COMMENT ON TABLE workflow_edges IS '워크플로우 노드 간 연결 (방향성 있는 엣지)';
COMMENT ON COLUMN workflow_edges.condition IS 'Decision 노드 분기 조건 (예: yes, no, pass, fail)';

-- -----------------------------------------------------------------------------
-- 5. workflow_node_executions 테이블 생성
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflow_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 인스턴스 및 노드 연결
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,

  -- 실행 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 대기 중
    'running',    -- 실행 중
    'completed',  -- 완료됨
    'failed',     -- 실패함
    'skipped'     -- 건너뜀
  )),

  -- 입출력 데이터
  input_data JSONB,
  output_data JSONB,
  decision_result TEXT,  -- Decision 노드의 선택 결과

  -- 시간 정보
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 에러 정보
  error_message TEXT,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_node_executions_instance ON workflow_node_executions(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_node ON workflow_node_executions(node_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_status ON workflow_node_executions(status);
CREATE INDEX IF NOT EXISTS idx_node_executions_active ON workflow_node_executions(workflow_instance_id, status)
  WHERE status IN ('pending', 'running');

COMMENT ON TABLE workflow_node_executions IS '워크플로우 노드별 실행 기록 (진행도 추적)';
COMMENT ON COLUMN workflow_node_executions.decision_result IS 'Decision 노드의 사용자 선택 결과';

-- -----------------------------------------------------------------------------
-- 6. workflow_definitions 및 workflow_instances에 FK 추가
-- -----------------------------------------------------------------------------

-- start_node_id 추가
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS start_node_id UUID REFERENCES workflow_nodes(id) ON DELETE SET NULL;

COMMENT ON COLUMN workflow_definitions.start_node_id IS '워크플로우 시작 노드';

-- current_node_id 추가
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS current_node_id UUID REFERENCES workflow_nodes(id) ON DELETE SET NULL;

COMMENT ON COLUMN workflow_instances.current_node_id IS '현재 진행 중인 노드';

-- -----------------------------------------------------------------------------
-- 7. RLS 정책
-- -----------------------------------------------------------------------------

ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_node_executions ENABLE ROW LEVEL SECURITY;

-- 개발/데모 모드: 모든 사용자 접근 허용
CREATE POLICY workflow_nodes_service_policy ON workflow_nodes
  FOR ALL USING (true);

CREATE POLICY workflow_edges_service_policy ON workflow_edges
  FOR ALL USING (true);

CREATE POLICY workflow_node_executions_service_policy ON workflow_node_executions
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 8. Realtime Publication
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_nodes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_edges;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_node_executions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 9. updated_at 트리거 (workflow_nodes)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_workflow_nodes_updated_at ON workflow_nodes;
CREATE TRIGGER trigger_workflow_nodes_updated_at
  BEFORE UPDATE ON workflow_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- -----------------------------------------------------------------------------
-- 10. Helper Functions
-- -----------------------------------------------------------------------------

-- 워크플로우의 다음 노드 조회
CREATE OR REPLACE FUNCTION get_next_workflow_node(
  p_current_node_id UUID,
  p_condition TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_next_node_id UUID;
BEGIN
  SELECT target_node_id INTO v_next_node_id
  FROM workflow_edges
  WHERE source_node_id = p_current_node_id
    AND (condition IS NULL OR condition = p_condition)
  ORDER BY priority DESC
  LIMIT 1;

  RETURN v_next_node_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_workflow_node IS '현재 노드에서 다음 노드 ID 조회';

-- 워크플로우 인스턴스 진행도 조회
CREATE OR REPLACE FUNCTION get_workflow_progress(
  p_instance_id UUID
)
RETURNS TABLE (
  node_key TEXT,
  node_name TEXT,
  phase TEXT,
  status TEXT,
  decision_result TEXT,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wn.node_key,
    wn.name AS node_name,
    wn.phase,
    wne.status,
    wne.decision_result,
    wne.completed_at
  FROM workflow_node_executions wne
  JOIN workflow_nodes wn ON wn.id = wne.node_id
  WHERE wne.workflow_instance_id = p_instance_id
  ORDER BY wne.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_workflow_progress IS '워크플로우 인스턴스의 진행 히스토리 조회';

-- 노드 실행 시작
CREATE OR REPLACE FUNCTION start_workflow_node(
  p_instance_id UUID,
  p_node_id UUID,
  p_input_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  -- 노드 실행 레코드 생성
  INSERT INTO workflow_node_executions (
    workflow_instance_id,
    node_id,
    status,
    input_data,
    started_at
  ) VALUES (
    p_instance_id,
    p_node_id,
    'running',
    p_input_data,
    now()
  ) RETURNING id INTO v_execution_id;

  -- 인스턴스의 current_node_id 업데이트
  UPDATE workflow_instances
  SET current_node_id = p_node_id,
      status = 'active',
      started_at = COALESCE(started_at, now())
  WHERE id = p_instance_id;

  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_workflow_node IS '워크플로우 노드 실행 시작';

-- 노드 실행 완료
CREATE OR REPLACE FUNCTION complete_workflow_node(
  p_execution_id UUID,
  p_output_data JSONB DEFAULT NULL,
  p_decision_result TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_instance_id UUID;
  v_node_id UUID;
  v_next_node_id UUID;
  v_node_type TEXT;
BEGIN
  -- 현재 실행 정보 조회
  SELECT workflow_instance_id, node_id INTO v_instance_id, v_node_id
  FROM workflow_node_executions
  WHERE id = p_execution_id;

  -- 노드 타입 조회
  SELECT node_type INTO v_node_type
  FROM workflow_nodes
  WHERE id = v_node_id;

  -- 실행 완료 처리
  UPDATE workflow_node_executions
  SET status = 'completed',
      output_data = p_output_data,
      decision_result = p_decision_result,
      completed_at = now()
  WHERE id = p_execution_id;

  -- 다음 노드 결정
  v_next_node_id := get_next_workflow_node(v_node_id, p_decision_result);

  IF v_next_node_id IS NOT NULL THEN
    -- 다음 노드로 이동
    UPDATE workflow_instances
    SET current_node_id = v_next_node_id
    WHERE id = v_instance_id;
  ELSE
    -- 워크플로우 완료
    UPDATE workflow_instances
    SET status = 'completed',
        current_node_id = NULL,
        completed_at = now()
    WHERE id = v_instance_id;
  END IF;

  RETURN v_next_node_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_workflow_node IS '워크플로우 노드 실행 완료 및 다음 노드 이동';

-- -----------------------------------------------------------------------------
-- 11. View: 워크플로우 인스턴스 현황
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW workflow_instance_status AS
SELECT
  wi.id,
  wi.instance_name,
  wd.name AS workflow_name,
  wd.command_name,
  wn.node_key,
  wn.name AS current_step,
  wn.phase,
  wi.status,
  wi.created_at,
  wi.started_at,
  wi.completed_at,
  (
    SELECT COUNT(*)
    FROM workflow_node_executions wne
    WHERE wne.workflow_instance_id = wi.id
      AND wne.status = 'completed'
  ) AS completed_nodes,
  (
    SELECT COUNT(*)
    FROM workflow_nodes wn2
    WHERE wn2.workflow_id = wd.id
  ) AS total_nodes
FROM workflow_instances wi
JOIN workflow_definitions wd ON wd.id = wi.workflow_definition_id
LEFT JOIN workflow_nodes wn ON wn.id = wi.current_node_id
ORDER BY wi.created_at DESC;

COMMENT ON VIEW workflow_instance_status IS '워크플로우 인스턴스 현황 조회 뷰';

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'BMad Greenfield Workflow 테이블 생성 완료';
  RAISE NOTICE '- workflow_nodes: 노드 정의 테이블';
  RAISE NOTICE '- workflow_edges: 노드 연결 테이블';
  RAISE NOTICE '- workflow_node_executions: 노드 실행 기록 테이블';
  RAISE NOTICE '- workflow_definitions에 command_name, start_node_id 추가';
  RAISE NOTICE '- workflow_instances에 instance_name, current_node_id 추가';
  RAISE NOTICE '- Helper functions 생성됨';
END;
$$;
