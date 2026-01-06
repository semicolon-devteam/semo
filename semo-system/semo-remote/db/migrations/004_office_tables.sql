-- =============================================================================
-- SEMO Office - DB Schema Extension
-- =============================================================================
--
-- Semo Office: GatherTown 스타일 가상 오피스에서 AI Agent들이 협업하는 멀티에이전트 시스템
--
-- 적용 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 또는 psql로 직접 실행: psql -f 004_office_tables.sql
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- offices: 가상 오피스 정의 (GitHub 레포지토리 매핑)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- GitHub 연동
  github_org VARCHAR(100) NOT NULL,
  github_repo VARCHAR(100) NOT NULL,
  repo_path VARCHAR(500),              -- 로컬 레포지토리 경로

  -- 레이아웃 설정
  layout JSONB DEFAULT '{
    "width": 800,
    "height": 600,
    "background": "office_default",
    "furniture": []
  }'::jsonb,

  -- 상태
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active',        -- 활성 상태
    'paused',        -- 일시 중지
    'archived'       -- 보관됨
  )),

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 유니크 제약
  UNIQUE(github_org, github_repo)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_offices_status ON offices(status);
CREATE INDEX IF NOT EXISTS idx_offices_github ON offices(github_org, github_repo);

-- -----------------------------------------------------------------------------
-- agent_personas: 에이전트 페르소나 정의 (역할별 성격/능력)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 역할 정보
  role VARCHAR(50) NOT NULL,           -- 'FE', 'BE', 'QA', 'PO', 'PM', 'Architect', 'DevOps'
  name VARCHAR(100),                   -- 표시 이름 (예: "김프론트")

  -- 아바타 설정
  avatar_config JSONB DEFAULT '{
    "sprite": "developer_default",
    "color": "#3B82F6"
  }'::jsonb,

  -- 페르소나 프롬프트 (시스템 메시지)
  persona_prompt TEXT NOT NULL,

  -- 담당 영역
  scope_patterns TEXT[] DEFAULT '{}',  -- ['src/app/**', 'components/**']

  -- 사용 가능 스킬
  skill_ids UUID[] DEFAULT '{}',       -- custom_skills 테이블 참조
  core_skills TEXT[] DEFAULT '{}',     -- ['write-code', 'create-pr', 'request-test']

  -- 참조 지식
  knowledge_refs TEXT[] DEFAULT '{}',  -- Git 경로 또는 URL

  -- 기본 페르소나 여부
  is_default BOOLEAN DEFAULT false,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_personas_role ON agent_personas(role);
CREATE INDEX IF NOT EXISTS idx_agent_personas_default ON agent_personas(is_default) WHERE is_default = true;

-- -----------------------------------------------------------------------------
-- custom_skills: 오피스별 커스텀 스킬 정의
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS custom_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 오피스 연결 (NULL이면 글로벌 스킬)
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,

  -- 스킬 정보
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 스킬 실행 프롬프트
  skill_prompt TEXT NOT NULL,

  -- 입출력 스키마
  input_schema JSONB DEFAULT '{}'::jsonb,
  output_format TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_skills_office ON custom_skills(office_id);

-- -----------------------------------------------------------------------------
-- worktrees: Git Worktree 관리 (에이전트별 물리적 작업 공간)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS worktrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 오피스 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- 워크트리 정보
  agent_role VARCHAR(50) NOT NULL,     -- 'FE', 'BE', 'QA' 등
  path VARCHAR(500) NOT NULL,          -- 워크트리 경로 (예: /workspace/agent/fe)
  branch VARCHAR(100) NOT NULL,        -- 브랜치명 (예: feature/fe-login-123)

  -- 세션 연결
  session_id VARCHAR(100),             -- Claude Code 세션 ID

  -- 상태
  status VARCHAR(20) DEFAULT 'idle' CHECK (status IN (
    'idle',          -- 유휴 상태
    'working',       -- 작업 중
    'blocked',       -- 의존성 대기
    'error'          -- 오류 발생
  )),

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약: 오피스당 역할별 하나의 워크트리
  UNIQUE(office_id, agent_role)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_worktrees_office ON worktrees(office_id);
CREATE INDEX IF NOT EXISTS idx_worktrees_status ON worktrees(status);

-- -----------------------------------------------------------------------------
-- office_agents: 에이전트 인스턴스 (런타임 상태)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS office_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES agent_personas(id),
  worktree_id UUID REFERENCES worktrees(id),

  -- 세션 정보
  session_id VARCHAR(100),             -- Claude Code 세션 ID

  -- 상태
  status VARCHAR(20) DEFAULT 'idle' CHECK (status IN (
    'idle',          -- 대기 중
    'working',       -- 작업 중
    'blocked',       -- 의존성 대기
    'error'          -- 오류 발생
  )),

  -- 오피스 내 위치 (픽셀 좌표)
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,

  -- 현재 작업 정보
  current_task TEXT,                   -- 현재 수행 중인 작업 설명
  last_message TEXT,                   -- 마지막 메시지 (말풍선용)

  -- 타임스탬프
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_office_agents_office ON office_agents(office_id);
CREATE INDEX IF NOT EXISTS idx_office_agents_status ON office_agents(status);

-- -----------------------------------------------------------------------------
-- job_queue: 작업 큐 (의존성 기반 스케줄링)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES office_agents(id),
  worktree_id UUID REFERENCES worktrees(id),

  -- 작업 정보
  title VARCHAR(200),                  -- 작업 제목
  description TEXT,                    -- 상세 설명

  -- 상태
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',       -- 대기 중 (의존성 미충족)
    'ready',         -- 준비됨 (실행 가능)
    'processing',    -- 처리 중
    'done',          -- 완료
    'failed',        -- 실패
    'cancelled'      -- 취소됨
  )),

  -- 의존성
  depends_on UUID[] DEFAULT '{}',      -- 의존하는 다른 job ID 배열

  -- PR 정보
  pr_number INT,                       -- 생성된 PR 번호
  branch_name VARCHAR(100),            -- 작업 브랜치명

  -- 우선순위
  priority INT DEFAULT 0,              -- 높을수록 우선 처리

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_job_queue_office ON job_queue(office_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_agent ON job_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority DESC, created_at ASC);

-- -----------------------------------------------------------------------------
-- agent_messages: 에이전트 간 메시지
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES office_agents(id),
  to_agent_id UUID REFERENCES office_agents(id), -- NULL이면 브로드캐스트

  -- 메시지 유형
  message_type VARCHAR(20) CHECK (message_type IN (
    'request',       -- 요청
    'response',      -- 응답
    'notification',  -- 알림
    'handoff'        -- 작업 인계
  )),

  -- 내용
  content TEXT NOT NULL,

  -- 컨텍스트 (관련 파일, 코드 스니펫 등)
  context JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_messages_office ON agent_messages(office_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);

-- -----------------------------------------------------------------------------
-- 트리거: updated_at 자동 갱신
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_office_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- offices
DROP TRIGGER IF EXISTS trigger_offices_updated_at ON offices;
CREATE TRIGGER trigger_offices_updated_at
  BEFORE UPDATE ON offices
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- agent_personas
DROP TRIGGER IF EXISTS trigger_agent_personas_updated_at ON agent_personas;
CREATE TRIGGER trigger_agent_personas_updated_at
  BEFORE UPDATE ON agent_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- worktrees
DROP TRIGGER IF EXISTS trigger_worktrees_updated_at ON worktrees;
CREATE TRIGGER trigger_worktrees_updated_at
  BEFORE UPDATE ON worktrees
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- office_agents
DROP TRIGGER IF EXISTS trigger_office_agents_updated_at ON office_agents;
CREATE TRIGGER trigger_office_agents_updated_at
  BEFORE UPDATE ON office_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_office_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (Row Level Security) 정책
-- -----------------------------------------------------------------------------

ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worktrees ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- 모든 테이블에 대해 service_role은 전체 접근 허용
-- 실제 RLS 정책은 사용자 인증 구현 후 추가

CREATE POLICY offices_service_policy ON offices
  FOR ALL USING (true);

CREATE POLICY agent_personas_service_policy ON agent_personas
  FOR ALL USING (true);

CREATE POLICY custom_skills_service_policy ON custom_skills
  FOR ALL USING (true);

CREATE POLICY worktrees_service_policy ON worktrees
  FOR ALL USING (true);

CREATE POLICY office_agents_service_policy ON office_agents
  FOR ALL USING (true);

CREATE POLICY job_queue_service_policy ON job_queue
  FOR ALL USING (true);

CREATE POLICY agent_messages_service_policy ON agent_messages
  FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 뷰: 오피스 대시보드
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW office_dashboard AS
SELECT
  o.id AS office_id,
  o.name AS office_name,
  o.github_org,
  o.github_repo,
  o.status AS office_status,
  COUNT(DISTINCT oa.id) AS agent_count,
  COUNT(DISTINCT CASE WHEN oa.status = 'working' THEN oa.id END) AS active_agents,
  COUNT(DISTINCT jq.id) FILTER (WHERE jq.status = 'pending') AS pending_jobs,
  COUNT(DISTINCT jq.id) FILTER (WHERE jq.status = 'processing') AS processing_jobs,
  COUNT(DISTINCT jq.id) FILTER (WHERE jq.status = 'done') AS completed_jobs
FROM offices o
LEFT JOIN office_agents oa ON o.id = oa.office_id
LEFT JOIN job_queue jq ON o.id = jq.office_id
GROUP BY o.id, o.name, o.github_org, o.github_repo, o.status;

-- -----------------------------------------------------------------------------
-- 뷰: Ready 상태 Job (실행 가능한 작업)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW ready_jobs AS
SELECT
  jq.*,
  o.name AS office_name,
  o.github_repo,
  ap.role AS agent_role,
  ap.name AS agent_name
FROM job_queue jq
JOIN offices o ON jq.office_id = o.id
LEFT JOIN office_agents oa ON jq.agent_id = oa.id
LEFT JOIN agent_personas ap ON oa.persona_id = ap.id
WHERE jq.status = 'ready'
ORDER BY jq.priority DESC, jq.created_at ASC;

-- -----------------------------------------------------------------------------
-- 함수: Job 의존성 해결
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_job_dependencies()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- 의존성이 모두 완료된 pending job을 ready로 전환
  UPDATE job_queue jq
  SET status = 'ready'
  WHERE jq.status = 'pending'
    AND (
      jq.depends_on = '{}'
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(jq.depends_on) AS dep_id
        WHERE NOT EXISTS (
          SELECT 1 FROM job_queue
          WHERE id = dep_id AND status = 'done'
        )
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 기본 페르소나 시드 데이터
-- -----------------------------------------------------------------------------

INSERT INTO agent_personas (role, name, persona_prompt, scope_patterns, core_skills, is_default) VALUES
(
  'PO',
  '박기획',
  '당신은 분석적이고 비전을 제시하는 Product Owner입니다.

## 성격
- 사용자 요구사항을 깊이 이해하고 분석합니다
- 비즈니스 가치와 기술적 실현 가능성을 균형있게 고려합니다
- 명확하고 상세한 기획서를 작성합니다

## 업무 스타일
- 항상 "왜?"라는 질문으로 시작합니다
- 사용자 스토리 형식으로 요구사항을 정리합니다
- 수용 기준(Acceptance Criteria)을 명확히 정의합니다',
  ARRAY['docs/**', '.github/ISSUE_TEMPLATE/**', 'README.md'],
  ARRAY['ideate', 'generate-spec'],
  true
),
(
  'FE',
  '김프론트',
  '당신은 창의적이고 디테일을 중시하는 프론트엔드 개발자입니다.

## 성격
- UI/UX에 대한 감각이 뛰어납니다
- 사용자 경험을 최우선으로 생각합니다
- 컴포넌트 재사용성과 접근성을 중요시합니다

## 업무 스타일
- 디자인 시스템을 따릅니다
- 반응형 디자인을 기본으로 구현합니다
- 성능 최적화(Code Splitting, Lazy Loading)를 고려합니다',
  ARRAY['src/app/**', 'src/components/**', 'src/styles/**', 'src/hooks/**'],
  ARRAY['write-code', 'create-pr', 'request-test'],
  true
),
(
  'BE',
  '이백엔드',
  '당신은 논리적이고 성능을 중시하는 백엔드 개발자입니다.

## 성격
- 확장성 있는 아키텍처를 설계합니다
- 안정적이고 효율적인 API를 구현합니다
- 데이터 정합성과 보안을 중요시합니다

## 업무 스타일
- RESTful API 설계 원칙을 따릅니다
- 에러 처리와 로깅을 철저히 합니다
- 단위 테스트와 통합 테스트를 작성합니다',
  ARRAY['src/api/**', 'src/lib/**', 'src/server/**', 'prisma/**'],
  ARRAY['write-code', 'create-pr', 'request-test'],
  true
),
(
  'QA',
  '최큐에이',
  '당신은 꼼꼼하고 회의적인 QA 엔지니어입니다.

## 성격
- 버그를 찾아내는 데 탁월합니다
- 철저한 테스트를 통해 품질을 보장합니다
- Edge case와 예외 상황을 항상 고려합니다

## 업무 스타일
- 테스트 케이스를 체계적으로 작성합니다
- E2E 테스트로 사용자 시나리오를 검증합니다
- 회귀 테스트를 통해 기존 기능을 보호합니다',
  ARRAY['tests/**', 'e2e/**', '__tests__/**', 'cypress/**', 'playwright/**'],
  ARRAY['write-test', 'request-test'],
  true
),
(
  'DevOps',
  '정데봅스',
  '당신은 자동화를 사랑하는 DevOps 엔지니어입니다.

## 성격
- CI/CD 파이프라인 최적화에 전문성을 가집니다
- 인프라 관리와 모니터링을 담당합니다
- "반복 작업은 자동화"를 신조로 합니다

## 업무 스타일
- GitHub Actions 워크플로우를 관리합니다
- Docker 컨테이너화와 배포를 담당합니다
- 의존성 업데이트와 보안 패치를 주기적으로 수행합니다',
  ARRAY['package.json', 'tsconfig.json', '.github/workflows/**', 'docker/**', 'Dockerfile', '.env.example'],
  ARRAY['deployer', 'circuit-breaker'],
  true
),
(
  'Architect',
  '한아키',
  '당신은 사려깊고 시스템적 사고를 하는 소프트웨어 아키텍트입니다.

## 성격
- 전체 시스템 구조를 설계하고 관리합니다
- 기술 부채와 확장성을 균형있게 고려합니다
- 팀원들에게 기술적 방향을 제시합니다

## 업무 스타일
- 아키텍처 결정 기록(ADR)을 작성합니다
- 코드 리뷰를 통해 일관성을 유지합니다
- 새로운 기술 도입 시 PoC를 수행합니다',
  ARRAY['**/types/**', 'src/lib/**', 'docs/architecture/**'],
  ARRAY['planner', 'write-code'],
  true
),
(
  'PM',
  '오피엠',
  '당신은 조율자이자 일정 관리자인 Project Manager입니다.

## 성격
- 팀원들의 작업을 조율하고 진행 상황을 추적합니다
- 리스크를 사전에 파악하고 대응합니다
- 이해관계자와의 커뮤니케이션을 담당합니다

## 업무 스타일
- 작업을 적절한 크기로 분해합니다
- 우선순위를 정하고 일정을 관리합니다
- 정기적인 상태 업데이트를 제공합니다',
  ARRAY['README.md', '.github/**', 'docs/project/**'],
  ARRAY['planner', 'notify-slack'],
  true
)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Semo Office DB 스키마 적용 완료';
  RAISE NOTICE '- offices: 가상 오피스 정의';
  RAISE NOTICE '- agent_personas: 에이전트 페르소나';
  RAISE NOTICE '- custom_skills: 커스텀 스킬';
  RAISE NOTICE '- worktrees: Git Worktree 관리';
  RAISE NOTICE '- office_agents: 에이전트 인스턴스';
  RAISE NOTICE '- job_queue: 작업 큐';
  RAISE NOTICE '- agent_messages: 에이전트 메시지';
  RAISE NOTICE '- 기본 페르소나 7개 생성됨';
END;
$$;
