-- Hub-and-Spoke 오케스트레이션 지원 스키마 확장
-- Phase 2: bot_commitments 세션 점유 컬럼
-- Phase 3: bot_sessions 라이프사이클 추적 컬럼
-- Phase 5: KB optimistic locking은 CLI 레벨에서 처리 (스키마 변경 불필요, version 컬럼 기존재)

-- ── Phase 2: bot_commitments 확장 ──

ALTER TABLE semo.bot_commitments
  ADD COLUMN IF NOT EXISTS assigned_session TEXT,
  ADD COLUMN IF NOT EXISTS session_owner TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_context JSONB DEFAULT '{}';

COMMENT ON COLUMN semo.bot_commitments.assigned_session IS '이 commitment를 처리 중인 세션 키';
COMMENT ON COLUMN semo.bot_commitments.session_owner IS '세션 소유자 ({user}-local, {bot}-cron-local 등)';
COMMENT ON COLUMN semo.bot_commitments.pipeline_context IS '파이프라인 컨텍스트 (service_id, phase, section_key 등)';

-- ── Phase 3: bot_sessions 확장 ──

ALTER TABLE semo.bot_sessions
  ADD COLUMN IF NOT EXISTS owner TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'claude-code',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS spawned_by TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';

COMMENT ON COLUMN semo.bot_sessions.owner IS '세션 소유자 ({user}-local, {bot}-cron-local 등)';
COMMENT ON COLUMN semo.bot_sessions.environment IS '실행 환경 (claude-code, agent-sdk, openclaw)';
COMMENT ON COLUMN semo.bot_sessions.status IS '세션 상태 (active, idle, terminated)';
COMMENT ON COLUMN semo.bot_sessions.spawned_by IS '이 세션을 생성한 상위 세션 키';

-- 활성 세션 인덱스
CREATE INDEX IF NOT EXISTS idx_bot_sessions_active
  ON semo.bot_sessions (bot_id, status) WHERE status = 'active';
