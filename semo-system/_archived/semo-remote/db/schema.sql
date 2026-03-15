-- =============================================================================
-- SEMO Remote - DB Schema
-- =============================================================================
--
-- 이 스키마는 core-central-db (On-premise Supabase)에 적용됩니다.
-- Prefix: remote_
--
-- 적용 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 또는 psql로 직접 실행
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- remote_requests: 원격 요청 테이블
-- -----------------------------------------------------------------------------
-- 권한 요청, 사용자 질문, 텍스트 입력 등을 저장
-- Mobile PWA에서 이 테이블을 폴링하여 대기 중인 요청을 확인

CREATE TABLE IF NOT EXISTS remote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 세션 정보
  session_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),

  -- 요청 유형
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'permission',      -- 도구 실행 권한 요청
    'user_question',   -- AskUserQuestion 호출
    'text_input',      -- 자유 텍스트 입력 필요
    'selection'        -- 선택지 중 선택 필요
  )),

  -- 요청 내용
  tool_name VARCHAR(100),           -- permission 타입 시: Bash, Write 등
  message TEXT NOT NULL,            -- 사용자에게 표시할 메시지
  options JSONB,                    -- selection 타입 시: 선택지 배열

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',         -- 응답 대기 중
    'approved',        -- 승인됨
    'denied',          -- 거부됨
    'responded',       -- 응답 완료 (텍스트 입력 등)
    'timeout',         -- 타임아웃
    'cancelled'        -- 취소됨
  )),

  -- 응답
  response TEXT,                    -- 사용자 응답 내용
  response_metadata JSONB,          -- 추가 메타데이터

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,           -- 만료 시간 (기본: 5분 후)

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_remote_requests_session
  ON remote_requests(session_id);

CREATE INDEX IF NOT EXISTS idx_remote_requests_status
  ON remote_requests(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_remote_requests_user
  ON remote_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_remote_requests_created
  ON remote_requests(created_at DESC);

-- -----------------------------------------------------------------------------
-- remote_sessions: 원격 세션 상태 테이블
-- -----------------------------------------------------------------------------
-- Claude Code 세션의 현재 상태를 추적
-- Mobile PWA에서 세션 상태를 확인하는 데 사용

CREATE TABLE IF NOT EXISTS remote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 세션 정보
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),

  -- 상태
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',          -- 활성 세션
    'idle',            -- 유휴 상태 (입력 대기)
    'waiting_input',   -- 사용자 입력 대기 중
    'processing',      -- 작업 처리 중
    'disconnected'     -- 연결 해제됨
  )),

  -- 세션 정보
  cwd VARCHAR(500),                 -- 작업 디렉토리
  last_activity_at TIMESTAMPTZ,     -- 마지막 활동 시간

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_remote_sessions_user
  ON remote_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_status
  ON remote_sessions(status);

-- -----------------------------------------------------------------------------
-- 트리거: updated_at 자동 갱신
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_remote_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_remote_sessions_updated_at ON remote_sessions;
CREATE TRIGGER trigger_remote_sessions_updated_at
  BEFORE UPDATE ON remote_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_remote_sessions_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (Row Level Security) 정책
-- -----------------------------------------------------------------------------

ALTER TABLE remote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 요청만 조회/수정 가능
CREATE POLICY remote_requests_user_policy ON remote_requests
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 사용자는 자신의 세션만 조회/수정 가능
CREATE POLICY remote_sessions_user_policy ON remote_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 뷰: 대기 중인 요청
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW remote_pending_requests AS
SELECT
  r.id,
  r.session_id,
  r.type,
  r.tool_name,
  r.message,
  r.options,
  r.created_at,
  r.expires_at,
  s.cwd AS session_cwd,
  EXTRACT(EPOCH FROM (NOW() - r.created_at)) AS age_seconds
FROM remote_requests r
LEFT JOIN remote_sessions s ON r.session_id = s.session_id
WHERE r.status = 'pending'
  AND (r.expires_at IS NULL OR r.expires_at > NOW())
ORDER BY r.created_at ASC;

-- -----------------------------------------------------------------------------
-- 함수: 요청 응답 처리
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION remote_respond(
  p_request_id UUID,
  p_response TEXT,
  p_status VARCHAR(20) DEFAULT 'responded'
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE remote_requests
  SET
    status = p_status,
    response = p_response,
    responded_at = NOW()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'response', response
  ) INTO v_result;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Request not found or already processed'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 함수: 만료된 요청 정리
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION remote_cleanup_expired()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE remote_requests
  SET status = 'timeout'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
