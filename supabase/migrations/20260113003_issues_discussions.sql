-- =============================================================================
-- SEMO Office - Issues & Discussions Tables (GitHub 대체)
-- =============================================================================
--
-- GitHub Issue, Project Status, Discussion을 Supabase로 대체
-- 코드/PR은 GitHub 유지, 메타데이터는 Supabase 관리
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- issues: GitHub Issue 대체 테이블
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 오피스 연결
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 이슈 번호 (오피스별 자동 증가)
  number SERIAL,

  -- 기본 정보
  title TEXT NOT NULL,
  body TEXT,

  -- 이슈 타입 (GitHub Issue Type 대체)
  issue_type VARCHAR(20) DEFAULT 'task' CHECK (issue_type IN (
    'task',      -- 일반 태스크
    'bug',       -- 버그
    'feature',   -- 기능 요청
    'epic',      -- 에픽
    'feedback'   -- 피드백
  )),

  -- 상태 (open/closed)
  state VARCHAR(20) DEFAULT 'open' CHECK (state IN (
    'open',
    'closed'
  )),

  -- Project Status (GitHub Projects 대체)
  status VARCHAR(30) DEFAULT 'backlog' CHECK (status IN (
    'backlog',       -- 백로그
    'todo',          -- 할 일
    'in_progress',   -- 진행 중 (작업중)
    'review',        -- 리뷰 요청
    'testing',       -- 테스트 중
    'done',          -- 완료
    'cancelled'      -- 취소됨
  )),

  -- 담당자 (에이전트 또는 사용자)
  assignee_id UUID REFERENCES agent_personas(id),
  assignee_name VARCHAR(100),  -- 표시용 이름

  -- 작업량 추정 (Point)
  estimation_point INTEGER,
  actual_point INTEGER,  -- 실제 소요 포인트

  -- 우선순위
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN (
    'critical',  -- 긴급
    'high',      -- 높음
    'medium',    -- 보통
    'low'        -- 낮음
  )),

  -- 레이블
  labels TEXT[] DEFAULT '{}',

  -- 관계 (에픽-태스크)
  parent_id UUID REFERENCES issues(id),  -- 상위 이슈 (에픽)

  -- GitHub 연동 (선택적 - 하이브리드 모드)
  github_issue_number INTEGER,
  github_issue_url TEXT,
  github_pr_number INTEGER,
  github_pr_url TEXT,

  -- 마일스톤
  milestone_id UUID,
  milestone_name VARCHAR(100),

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_issues_office ON issues(office_id);
CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_parent ON issues(parent_id);
CREATE INDEX IF NOT EXISTS idx_issues_milestone ON issues(milestone_id);
CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created_at DESC);

-- GIN 인덱스 (레이블 검색용)
CREATE INDEX IF NOT EXISTS idx_issues_labels_gin ON issues USING GIN(labels);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_issues_updated_at ON issues;
CREATE TRIGGER trigger_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY issues_service_policy ON issues
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE issues;

-- -----------------------------------------------------------------------------
-- issue_comments: 이슈 댓글
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 이슈 연결
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

  -- 작성자 (에이전트 또는 사용자)
  author_id UUID REFERENCES agent_personas(id),
  author_name VARCHAR(100),

  -- 내용
  body TEXT NOT NULL,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_created ON issue_comments(created_at);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_issue_comments_updated_at ON issue_comments;
CREATE TRIGGER trigger_issue_comments_updated_at
  BEFORE UPDATE ON issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY issue_comments_service_policy ON issue_comments
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE issue_comments;

-- -----------------------------------------------------------------------------
-- issue_status_history: 이슈 상태 변경 이력
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 이슈 연결
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,

  -- 상태 변경
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,

  -- 변경자
  changed_by_id UUID REFERENCES agent_personas(id),
  changed_by_name VARCHAR(100),

  -- 변경 사유
  reason TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_issue_status_history_issue ON issue_status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_status_history_created ON issue_status_history(created_at);

-- RLS 정책
ALTER TABLE issue_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY issue_status_history_service_policy ON issue_status_history
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- discussions: GitHub Discussion 대체 테이블
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 오피스 연결
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 카테고리
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'meeting-minutes',   -- 회의록
    'decision-log',      -- 의사결정 로그
    'announcement',      -- 공지사항
    'general',           -- 일반 토론
    'ideas',             -- 아이디어
    'q-and-a'            -- 질문과 답변
  )),

  -- 기본 정보
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- 작성자
  author_id UUID REFERENCES agent_personas(id),
  author_name VARCHAR(100),

  -- 상태
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,

  -- 레이블
  labels TEXT[] DEFAULT '{}',

  -- 관련 이슈
  related_issues UUID[] DEFAULT '{}',

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_discussions_office ON discussions(office_id);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_pinned ON discussions(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_discussions_created ON discussions(created_at DESC);

-- GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_discussions_labels_gin ON discussions USING GIN(labels);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_discussions_updated_at ON discussions;
CREATE TRIGGER trigger_discussions_updated_at
  BEFORE UPDATE ON discussions
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY discussions_service_policy ON discussions
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE discussions;

-- -----------------------------------------------------------------------------
-- discussion_comments: 토론 댓글
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 토론 연결
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,

  -- 작성자
  author_id UUID REFERENCES agent_personas(id),
  author_name VARCHAR(100),

  -- 내용
  body TEXT NOT NULL,

  -- 답글 관계
  parent_id UUID REFERENCES discussion_comments(id),

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_discussion_comments_discussion ON discussion_comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent ON discussion_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_created ON discussion_comments(created_at);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_discussion_comments_updated_at ON discussion_comments;
CREATE TRIGGER trigger_discussion_comments_updated_at
  BEFORE UPDATE ON discussion_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE discussion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY discussion_comments_service_policy ON discussion_comments
  FOR ALL USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE discussion_comments;

-- -----------------------------------------------------------------------------
-- milestones: 마일스톤 테이블
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 오피스 연결
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 기본 정보
  title VARCHAR(100) NOT NULL,
  description TEXT,

  -- 상태
  state VARCHAR(20) DEFAULT 'open' CHECK (state IN (
    'open',
    'closed'
  )),

  -- 기간
  due_date DATE,
  closed_at TIMESTAMPTZ,

  -- GitHub 연동 (선택적)
  github_milestone_number INTEGER,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_milestones_office ON milestones(office_id);
CREATE INDEX IF NOT EXISTS idx_milestones_state ON milestones(state);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON milestones(due_date);

-- updated_at 트리거
DROP TRIGGER IF EXISTS trigger_milestones_updated_at ON milestones;
CREATE TRIGGER trigger_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- RLS 정책
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY milestones_service_policy ON milestones
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 뷰: 버그 목록 (list-bugs 스킬용)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW bug_list AS
SELECT
  i.id,
  i.number,
  i.title,
  i.status,
  i.priority,
  i.assignee_name,
  i.labels,
  i.created_at,
  i.office_id
FROM issues i
WHERE i.issue_type = 'bug'
  AND i.state = 'open'
ORDER BY
  CASE i.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  i.created_at DESC;

-- -----------------------------------------------------------------------------
-- 뷰: 이슈 대시보드
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW issue_dashboard AS
SELECT
  i.office_id,
  i.issue_type,
  i.status,
  COUNT(*) AS count
FROM issues i
WHERE i.state = 'open'
GROUP BY i.office_id, i.issue_type, i.status;

-- -----------------------------------------------------------------------------
-- 함수: 이슈 상태 변경 (자동 이력 기록)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_issue_status(
  p_issue_id UUID,
  p_new_status VARCHAR(30),
  p_changed_by_id UUID DEFAULT NULL,
  p_changed_by_name VARCHAR(100) DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_old_status VARCHAR(30);
BEGIN
  -- 현재 상태 조회
  SELECT status INTO v_old_status FROM issues WHERE id = p_issue_id;

  IF v_old_status IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 상태 변경
  UPDATE issues
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_issue_id;

  -- 이력 기록
  INSERT INTO issue_status_history (
    issue_id, from_status, to_status,
    changed_by_id, changed_by_name, reason
  ) VALUES (
    p_issue_id, v_old_status, p_new_status,
    p_changed_by_id, p_changed_by_name, p_reason
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 함수: 피드백 이슈 생성 (create-feedback-issue 스킬용)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_feedback_issue(
  p_office_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_package VARCHAR(100) DEFAULT NULL,
  p_labels TEXT[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_issue_id UUID;
BEGIN
  INSERT INTO issues (
    office_id, title, body, issue_type, labels, metadata
  ) VALUES (
    p_office_id,
    p_title,
    p_body,
    'feedback',
    p_labels,
    jsonb_build_object('package', p_package)
  )
  RETURNING id INTO v_issue_id;

  RETURN v_issue_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'issues & discussions 테이블 생성 완료';
  RAISE NOTICE '- issues: GitHub Issue 대체';
  RAISE NOTICE '- issue_comments: 이슈 댓글';
  RAISE NOTICE '- issue_status_history: 상태 변경 이력';
  RAISE NOTICE '- discussions: GitHub Discussion 대체';
  RAISE NOTICE '- discussion_comments: 토론 댓글';
  RAISE NOTICE '- milestones: 마일스톤';
  RAISE NOTICE '- bug_list 뷰 생성됨 (list-bugs 스킬용)';
  RAISE NOTICE '- update_issue_status 함수 생성됨';
  RAISE NOTICE '- create_feedback_issue 함수 생성됨';
END;
$$;
