-- =============================================================================
-- SEMO Office - Agent Commands Extension
-- =============================================================================
--
-- semo-remote-client와 Semo Office 통합을 위한 명령 전달 테이블
--
-- 흐름:
-- 1. Office Server가 job_queue에서 ready 작업 감지
-- 2. agent_commands에 명령 INSERT
-- 3. semo-remote-client가 Realtime으로 수신
-- 4. iTerm2 Python API로 Claude Code에 명령 전송
-- 5. 결과를 agent_command_results에 저장
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- agent_commands: Office Server → semo-remote-client 명령 전달
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES office_agents(id),
  job_id UUID REFERENCES job_queue(id),

  -- iTerm 세션 정보
  iterm_session_id VARCHAR(100),         -- iTerm2 세션 ID (pty-xxx-xxx)

  -- 명령 정보
  command_type VARCHAR(30) NOT NULL CHECK (command_type IN (
    'create_session',    -- 새 Claude Code 세션 생성
    'send_prompt',       -- 프롬프트 전송
    'send_text',         -- 일반 텍스트 전송
    'get_output',        -- 출력 조회
    'cancel',            -- 현재 작업 취소 (Ctrl+C)
    'terminate'          -- 세션 종료
  )),

  -- 명령 페이로드
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- create_session: { worktree_path, persona_prompt, skills }
  -- send_prompt: { prompt, method: "applescript" | "direct" }
  -- send_text: { text }
  -- get_output: { lines: 100 }

  -- 상태
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',           -- 대기 중
    'processing',        -- semo-remote-client가 처리 중
    'completed',         -- 완료
    'failed',            -- 실패
    'timeout'            -- 타임아웃
  )),

  -- 에러 정보
  error_message TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 타임아웃 설정 (기본 5분)
  timeout_seconds INT DEFAULT 300
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_commands_office ON agent_commands(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_commands_status ON agent_commands(status);
CREATE INDEX IF NOT EXISTS idx_agent_commands_pending ON agent_commands(status, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_commands_iterm ON agent_commands(iterm_session_id);

-- -----------------------------------------------------------------------------
-- agent_command_results: 명령 실행 결과
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_command_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  command_id UUID NOT NULL REFERENCES agent_commands(id) ON DELETE CASCADE,

  -- 결과
  success BOOLEAN NOT NULL DEFAULT false,
  output TEXT,                           -- 세션 출력 내용
  pr_number INT,                         -- 생성된 PR 번호 (있는 경우)

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,
  -- { duration_ms, lines_count, branch_name, commit_hash }

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_command_results_command ON agent_command_results(command_id);

-- -----------------------------------------------------------------------------
-- agent_sessions: iTerm 세션 등록 (semo-remote-client가 관리)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES office_agents(id),
  worktree_id UUID REFERENCES worktrees(id),

  -- iTerm 세션 정보
  iterm_session_id VARCHAR(100) NOT NULL,  -- iTerm2 세션 ID
  iterm_tab_name VARCHAR(200),             -- 탭 이름

  -- Claude Code 정보
  is_claude_code BOOLEAN DEFAULT false,
  claude_version VARCHAR(50),

  -- 상태
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active',            -- 활성
    'idle',              -- 유휴
    'disconnected'       -- 연결 끊김
  )),

  -- 작업 디렉토리
  cwd VARCHAR(500),

  -- 마지막 활동
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약
  UNIQUE(iterm_session_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_sessions_office ON agent_sessions(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_iterm ON agent_sessions(iterm_session_id);

-- -----------------------------------------------------------------------------
-- 트리거: updated_at 자동 갱신
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_agent_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_sessions_updated_at ON agent_sessions;
CREATE TRIGGER trigger_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_sessions_updated_at();

-- -----------------------------------------------------------------------------
-- Realtime 활성화
-- -----------------------------------------------------------------------------

-- agent_commands 테이블 Realtime 활성화 (semo-remote-client가 구독)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands;

-- agent_command_results 테이블 Realtime 활성화 (Office Server가 구독)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_command_results;

-- agent_sessions 테이블 Realtime 활성화 (Office UI가 구독)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_sessions;

-- -----------------------------------------------------------------------------
-- RLS (Row Level Security) 정책
-- -----------------------------------------------------------------------------

ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_command_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- 서비스 롤은 모든 접근 허용
CREATE POLICY "Service role full access on agent_commands" ON agent_commands
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_command_results" ON agent_command_results
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_sessions" ON agent_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 기본 데이터 정리 함수 (오래된 명령 삭제)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_old_commands()
RETURNS void AS $$
BEGIN
  -- 24시간 이상 된 완료/실패 명령 삭제
  DELETE FROM agent_commands
  WHERE status IN ('completed', 'failed', 'timeout')
    AND created_at < NOW() - INTERVAL '24 hours';

  -- 타임아웃 처리 (timeout_seconds 초과)
  UPDATE agent_commands
  SET status = 'timeout',
      completed_at = NOW(),
      error_message = 'Command timed out'
  WHERE status = 'pending'
    AND created_at < NOW() - (timeout_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;
