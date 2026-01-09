-- ============================================================================
-- Phase 10-16: Workflow Communication Tables
-- ============================================================================
-- Phase 10: User Questions
-- Phase 11: Agent Invocations
-- Phase 12: Agent Results
-- Phase 15: Task Queue
-- Phase 16: Workflow Execution
-- ============================================================================

-- ============================================================================
-- Phase 10: User Questions Table
-- ============================================================================
-- Agent가 사용자에게 질문하고 응답을 받는 테이블

CREATE TABLE IF NOT EXISTS user_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES office_agents(id) ON DELETE CASCADE,
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,

  -- 질문 내용
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'selection', 'confirmation')),
  question TEXT NOT NULL,
  options JSONB, -- selection 타입일 때 선택지 배열
  context JSONB, -- 추가 컨텍스트 정보

  -- 우선순위
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),

  -- 응답
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'timeout', 'cancelled')),
  response TEXT,
  answered_at TIMESTAMPTZ,

  -- 타임아웃
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL이면 타임아웃 없음

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_questions_office ON user_questions(office_id, status);
CREATE INDEX IF NOT EXISTS idx_user_questions_agent ON user_questions(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_workflow ON user_questions(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_status_expires ON user_questions(status, expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

COMMENT ON TABLE user_questions IS 'Agent가 사용자에게 하는 질문 및 응답';
COMMENT ON COLUMN user_questions.question_type IS 'text: 텍스트 입력, selection: 선택지, confirmation: 확인/취소';
COMMENT ON COLUMN user_questions.options IS 'selection 타입일 때 선택지 배열 (예: ["옵션1", "옵션2"])';

-- ============================================================================
-- Phase 11: Agent Invocations Table
-- ============================================================================
-- Agent 간 호출 관계 추적

CREATE TABLE IF NOT EXISTS agent_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,

  -- 호출 관계
  caller_agent_id UUID NOT NULL REFERENCES office_agents(id) ON DELETE CASCADE,
  callee_agent_id UUID NOT NULL REFERENCES office_agents(id) ON DELETE CASCADE,

  -- 호출 내용
  invocation_type TEXT NOT NULL DEFAULT 'task' CHECK (invocation_type IN ('task', 'question', 'collaboration')),
  reason TEXT, -- 호출 사유 (간단한 설명)
  context JSONB DEFAULT '{}'::jsonb, -- 호출 컨텍스트 데이터
  payload JSONB DEFAULT '{}'::jsonb,

  -- 호출자 위치 (UI 애니메이션용)
  caller_position_x REAL,
  caller_position_y REAL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'rejected', 'timeout')),
  result TEXT,

  -- 시간
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_invocations_office ON agent_invocations(office_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_caller ON agent_invocations(caller_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_callee ON agent_invocations(callee_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_workflow ON agent_invocations(workflow_instance_id);

COMMENT ON TABLE agent_invocations IS 'Agent 간 호출 관계 및 협업 추적';
COMMENT ON COLUMN agent_invocations.invocation_type IS 'task: 작업 위임, question: 질문, collaboration: 협업 요청';

-- ============================================================================
-- Phase 12: Agent Results Table
-- ============================================================================
-- Agent 작업 결과물 저장

CREATE TABLE IF NOT EXISTS agent_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES office_agents(id) ON DELETE CASCADE,
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
  invocation_id UUID REFERENCES agent_invocations(id) ON DELETE SET NULL,

  -- 결과 내용
  result_type TEXT NOT NULL CHECK (result_type IN ('file', 'github_issue', 'github_pr', 'text', 'structured_data')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- 수신자 (특정 Agent에게 전달할 때)
  target_agent_id UUID REFERENCES office_agents(id) ON DELETE SET NULL,

  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 첨부 파일 경로 (file 타입일 때)
  file_paths TEXT[],

  -- GitHub 관련 (github_issue/github_pr 타입일 때)
  github_url TEXT,
  github_number INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_results_office ON agent_results(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_results_agent ON agent_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_results_target ON agent_results(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_results_workflow ON agent_results(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_agent_results_invocation ON agent_results(invocation_id);

COMMENT ON TABLE agent_results IS 'Agent 작업 결과물 저장 및 전달';
COMMENT ON COLUMN agent_results.result_type IS 'file: 파일, github_issue: Issue, github_pr: PR, text: 텍스트, structured_data: 구조화 데이터';

-- ============================================================================
-- Phase 15: Agent Task Queue Table
-- ============================================================================
-- 역할별 동시성 전략을 위한 작업 큐

CREATE TABLE IF NOT EXISTS agent_task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES office_agents(id) ON DELETE CASCADE,

  -- 작업 정보
  task_type TEXT NOT NULL, -- 'workflow_step', 'invocation', 'user_command' 등
  task_reference_id UUID NOT NULL, -- workflow_step_id, invocation_id 등
  priority INTEGER NOT NULL DEFAULT 0, -- 높을수록 우선순위 높음

  -- 상태
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'executing', 'completed', 'failed', 'cancelled')),

  -- 동시성 제어
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 재시도
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,

  -- 시간
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_task_queue_agent_status ON agent_task_queue(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_task_queue_office ON agent_task_queue(office_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON agent_task_queue(priority DESC, created_at ASC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_task_queue_reference ON agent_task_queue(task_type, task_reference_id);

COMMENT ON TABLE agent_task_queue IS '역할별 동시성 전략을 위한 Agent 작업 큐';
COMMENT ON COLUMN agent_task_queue.priority IS '우선순위 (높을수록 먼저 실행)';

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_agent_task_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_task_queue_updated_at
  BEFORE UPDATE ON agent_task_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_task_queue_updated_at();

-- ============================================================================
-- Phase 16: Workflow Step Executions Table (확장)
-- ============================================================================
-- workflow_step_executions 테이블이 이미 존재한다고 가정
-- 추가 컬럼이 필요하면 ALTER TABLE로 추가

-- output 컬럼 추가 (아직 없다면)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_step_executions' AND column_name = 'output'
  ) THEN
    ALTER TABLE workflow_step_executions ADD COLUMN output JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN workflow_step_executions.output IS '단계 실행 결과 (산출물, 메시지 등)';
  END IF;
END $$;

-- error_message 컬럼 추가 (아직 없다면)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_step_executions' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE workflow_step_executions ADD COLUMN error_message TEXT;
    COMMENT ON COLUMN workflow_step_executions.error_message IS '실행 실패 시 에러 메시지';
  END IF;
END $$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- 개발/데모 모드: 모든 사용자 접근 허용 (추후 인증 구현 시 수정)

-- user_questions policies
ALTER TABLE user_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_questions_service_policy" ON user_questions;
CREATE POLICY "user_questions_service_policy" ON user_questions FOR ALL USING (true);

-- agent_invocations policies
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_invocations_service_policy" ON agent_invocations;
CREATE POLICY "agent_invocations_service_policy" ON agent_invocations FOR ALL USING (true);

-- agent_results policies
ALTER TABLE agent_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_results_service_policy" ON agent_results;
CREATE POLICY "agent_results_service_policy" ON agent_results FOR ALL USING (true);

-- agent_task_queue policies
ALTER TABLE agent_task_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_task_queue_service_policy" ON agent_task_queue;
CREATE POLICY "agent_task_queue_service_policy" ON agent_task_queue FOR ALL USING (true);

-- ============================================================================
-- Realtime Publication
-- ============================================================================

-- Realtime 활성화
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_questions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_invocations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_results; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_task_queue; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- 질문 타임아웃 체크 함수
CREATE OR REPLACE FUNCTION check_question_timeouts()
RETURNS void AS $$
BEGIN
  UPDATE user_questions
  SET status = 'timeout'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_question_timeouts IS '타임아웃된 질문을 자동으로 timeout 상태로 변경';

-- 질문 응답 함수
CREATE OR REPLACE FUNCTION answer_question(
  p_question_id UUID,
  p_response TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE user_questions
  SET
    status = 'answered',
    response = p_response,
    answered_at = now()
  WHERE id = p_question_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found or already answered';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION answer_question IS '질문에 응답';

-- Agent 가용성 체크 함수
CREATE OR REPLACE FUNCTION get_agent_active_task_count(p_agent_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM agent_task_queue
    WHERE agent_id = p_agent_id
      AND status IN ('assigned', 'executing')
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_agent_active_task_count IS 'Agent의 현재 실행 중인 작업 수 반환';
