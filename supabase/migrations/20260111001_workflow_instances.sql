-- =============================================================================
-- SEMO Office - Workflow Instances Tables
-- =============================================================================
-- Phase 16: Workflow Execution - workflow_instances, workflow_step_executions
-- 이 마이그레이션은 workflow_communication.sql 보다 먼저 실행되어야 함
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. workflow_instances 테이블 생성
-- -----------------------------------------------------------------------------
-- 워크플로우 실행 인스턴스 (사용자 명령 → 워크플로우 실행)

CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- 워크플로우 정의 참조
  workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,

  -- 시작 정보
  initiator_agent_id UUID REFERENCES office_agents(id) ON DELETE SET NULL, -- 시작한 Agent (보통 Orchestrator)
  user_command TEXT NOT NULL, -- 원본 사용자 명령

  -- 실행 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled')),
  current_step TEXT, -- 현재 진행 중인 단계 이름

  -- 워크플로우 컨텍스트 (단계 간 공유 데이터)
  context JSONB DEFAULT '{}'::jsonb,

  -- 결과
  result JSONB, -- 최종 결과물
  error_message TEXT, -- 실패 시 에러 메시지

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_instances_office ON workflow_instances(office_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_definition ON workflow_instances(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_initiator ON workflow_instances(initiator_agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_active ON workflow_instances(office_id, status)
  WHERE status IN ('pending', 'active', 'paused');

COMMENT ON TABLE workflow_instances IS '워크플로우 실행 인스턴스';
COMMENT ON COLUMN workflow_instances.user_command IS '사용자가 입력한 원본 명령';
COMMENT ON COLUMN workflow_instances.context IS '단계 간 공유되는 컨텍스트 데이터';

-- -----------------------------------------------------------------------------
-- 2. workflow_step_executions 테이블 생성
-- -----------------------------------------------------------------------------
-- 워크플로우 단계 실행 기록

CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,

  -- 단계 정보
  step_name TEXT NOT NULL,
  step_index INTEGER NOT NULL, -- 단계 순서 (0부터 시작)
  agent_id UUID REFERENCES office_agents(id) ON DELETE SET NULL, -- 실행하는 Agent

  -- 실행 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_input', 'completed', 'failed', 'skipped')),

  -- 입출력 데이터
  input_data JSONB, -- 단계 입력 데이터
  output_data JSONB, -- 단계 출력 데이터
  artifacts JSONB, -- 산출물 목록 [{type, title, url, ...}]

  -- 에러 정보
  error_message TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 인스턴스 내에서 단계 순서는 유일
  UNIQUE(instance_id, step_index)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_step_executions_instance ON workflow_step_executions(instance_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_agent ON workflow_step_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_status ON workflow_step_executions(status);
CREATE INDEX IF NOT EXISTS idx_step_executions_active ON workflow_step_executions(instance_id, status)
  WHERE status IN ('in_progress', 'waiting_input');

COMMENT ON TABLE workflow_step_executions IS '워크플로우 단계 실행 기록';
COMMENT ON COLUMN workflow_step_executions.step_index IS '단계 순서 (0부터 시작)';
COMMENT ON COLUMN workflow_step_executions.artifacts IS '산출물 목록: [{type, title, url, ...}]';

-- -----------------------------------------------------------------------------
-- 3. RLS 정책
-- -----------------------------------------------------------------------------

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

-- 개발/데모 모드: 모든 사용자 접근 허용 (추후 인증 구현 시 수정)
DROP POLICY IF EXISTS "workflow_instances_service_policy" ON workflow_instances;
CREATE POLICY "workflow_instances_service_policy" ON workflow_instances
  FOR ALL USING (true);

DROP POLICY IF EXISTS "step_executions_service_policy" ON workflow_step_executions;
CREATE POLICY "step_executions_service_policy" ON workflow_step_executions
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 4. Realtime Publication
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_instances;
EXCEPTION WHEN duplicate_object THEN
  -- 이미 추가됨
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workflow_step_executions;
EXCEPTION WHEN duplicate_object THEN
  -- 이미 추가됨
END $$;

-- -----------------------------------------------------------------------------
-- 5. Helper Functions
-- -----------------------------------------------------------------------------

-- 워크플로우 인스턴스 생성 함수
CREATE OR REPLACE FUNCTION create_workflow_instance(
  p_office_id UUID,
  p_user_command TEXT,
  p_workflow_definition_id UUID DEFAULT NULL,
  p_initiator_agent_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_instance_id UUID;
  v_definition RECORD;
  v_step RECORD;
  v_step_index INTEGER := 0;
BEGIN
  -- 워크플로우 인스턴스 생성
  INSERT INTO workflow_instances (
    office_id,
    workflow_definition_id,
    initiator_agent_id,
    user_command,
    status
  ) VALUES (
    p_office_id,
    p_workflow_definition_id,
    p_initiator_agent_id,
    p_user_command,
    'pending'
  ) RETURNING id INTO v_instance_id;

  -- 워크플로우 정의가 있으면 단계 생성
  IF p_workflow_definition_id IS NOT NULL THEN
    SELECT * INTO v_definition
    FROM workflow_definitions
    WHERE id = p_workflow_definition_id;

    IF v_definition IS NOT NULL AND v_definition.steps IS NOT NULL THEN
      FOR v_step IN SELECT * FROM jsonb_array_elements(v_definition.steps)
      LOOP
        INSERT INTO workflow_step_executions (
          instance_id,
          step_name,
          step_index,
          status
        ) VALUES (
          v_instance_id,
          v_step.value->>'name',
          v_step_index,
          'pending'
        );
        v_step_index := v_step_index + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_workflow_instance IS '워크플로우 인스턴스 생성 및 단계 초기화';

-- 워크플로우 단계 시작 함수
CREATE OR REPLACE FUNCTION start_workflow_step(
  p_instance_id UUID,
  p_step_name TEXT,
  p_agent_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- 단계 상태 업데이트
  UPDATE workflow_step_executions
  SET
    status = 'in_progress',
    agent_id = COALESCE(p_agent_id, agent_id),
    started_at = now()
  WHERE instance_id = p_instance_id
    AND step_name = p_step_name
    AND status = 'pending';

  -- 인스턴스 상태 업데이트
  UPDATE workflow_instances
  SET
    status = 'active',
    current_step = p_step_name,
    started_at = COALESCE(started_at, now())
  WHERE id = p_instance_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_workflow_step IS '워크플로우 단계 시작';

-- 워크플로우 단계 완료 함수
CREATE OR REPLACE FUNCTION complete_workflow_step(
  p_instance_id UUID,
  p_step_name TEXT,
  p_output_data JSONB DEFAULT NULL,
  p_artifacts JSONB DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_next_step RECORD;
  v_all_completed BOOLEAN;
BEGIN
  -- 단계 완료 처리
  UPDATE workflow_step_executions
  SET
    status = 'completed',
    output_data = p_output_data,
    artifacts = p_artifacts,
    completed_at = now()
  WHERE instance_id = p_instance_id
    AND step_name = p_step_name
    AND status IN ('in_progress', 'waiting_input');

  -- 다음 단계 확인
  SELECT * INTO v_next_step
  FROM workflow_step_executions
  WHERE instance_id = p_instance_id
    AND status = 'pending'
  ORDER BY step_index
  LIMIT 1;

  IF v_next_step IS NOT NULL THEN
    -- 다음 단계가 있으면 현재 단계 업데이트
    UPDATE workflow_instances
    SET current_step = v_next_step.step_name
    WHERE id = p_instance_id;
  ELSE
    -- 모든 단계 완료 확인
    SELECT NOT EXISTS (
      SELECT 1 FROM workflow_step_executions
      WHERE instance_id = p_instance_id
        AND status NOT IN ('completed', 'skipped')
    ) INTO v_all_completed;

    IF v_all_completed THEN
      -- 워크플로우 완료
      UPDATE workflow_instances
      SET
        status = 'completed',
        current_step = NULL,
        completed_at = now()
      WHERE id = p_instance_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_workflow_step IS '워크플로우 단계 완료 및 다음 단계 진행';
