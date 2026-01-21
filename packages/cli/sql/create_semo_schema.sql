-- =============================================================================
-- SEMO Schema 생성 스크립트
--
-- 실행 대상: 팀 코어 PostgreSQL (3.38.162.21 / appdb)
-- 스키마: semo
--
-- 테이블:
--   - semo.skills: 스킬 정의 및 SKILL.md 내용
--   - semo.commands: 커맨드 정의 및 .md 내용
--   - semo.agents: 에이전트 정의 및 agent.md 내용
--   - semo.packages: 패키지 정의
-- =============================================================================

-- 스키마 생성
CREATE SCHEMA IF NOT EXISTS semo;

-- =============================================================================
-- 1. semo.skills 테이블
-- =============================================================================

DROP TABLE IF EXISTS semo.skills CASCADE;

CREATE TABLE semo.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 스킬 식별
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,

  -- 핵심: SKILL.md 전체 내용
  content TEXT NOT NULL,

  -- 분류
  category VARCHAR(50),  -- workflow, discovery, planning, solutioning, implementation, supporting
  package VARCHAR(50) DEFAULT 'core',

  -- 설치 제어
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  install_order INT DEFAULT 100,

  -- 버전
  version VARCHAR(20) DEFAULT '1.0.0',

  -- 메타
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_semo_skills_name ON semo.skills(name);
CREATE INDEX idx_semo_skills_active ON semo.skills(is_active);
CREATE INDEX idx_semo_skills_category ON semo.skills(category);

-- =============================================================================
-- 2. semo.commands 테이블
-- =============================================================================

DROP TABLE IF EXISTS semo.commands CASCADE;

CREATE TABLE semo.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 커맨드 식별
  name VARCHAR(100) NOT NULL,      -- help, dry-run, greenfield
  folder VARCHAR(50) NOT NULL,     -- SEMO, SEMO-workflow

  -- 핵심: .md 파일 전체 내용
  content TEXT NOT NULL,

  description TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(folder, name)
);

CREATE INDEX idx_semo_commands_folder ON semo.commands(folder);
CREATE INDEX idx_semo_commands_active ON semo.commands(is_active);

-- =============================================================================
-- 3. semo.agents 테이블
-- =============================================================================

DROP TABLE IF EXISTS semo.agents CASCADE;

CREATE TABLE semo.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 에이전트 식별
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),

  -- 핵심: agent.md 전체 내용
  content TEXT NOT NULL,

  package VARCHAR(50) DEFAULT 'core',
  is_active BOOLEAN DEFAULT true,
  install_order INT DEFAULT 100,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_semo_agents_name ON semo.agents(name);
CREATE INDEX idx_semo_agents_active ON semo.agents(is_active);

-- =============================================================================
-- 4. semo.packages 테이블
-- =============================================================================

DROP TABLE IF EXISTS semo.packages CASCADE;

CREATE TABLE semo.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,

  layer VARCHAR(50),        -- standard, biz, eng, ops, meta, system
  package_type VARCHAR(50), -- standard, extension

  version VARCHAR(20) DEFAULT '1.0.0',

  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  install_order INT DEFAULT 100,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_semo_packages_name ON semo.packages(name);
CREATE INDEX idx_semo_packages_layer ON semo.packages(layer);
CREATE INDEX idx_semo_packages_active ON semo.packages(is_active);

-- =============================================================================
-- 시드 데이터: 핵심 스킬 19개
-- =============================================================================

-- Workflow (3개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('workflow-start', '워크플로우 시작', '워크플로우 인스턴스 생성 및 시작',
   E'---\nname: workflow-start\ndescription: 워크플로우 인스턴스 생성 및 시작\n---\n\n# workflow-start\n\n워크플로우 인스턴스를 생성하고 시작합니다.\n\n## Usage\n\n```\nskill:workflow-start workflow_command=\"greenfield\"\n```\n',
   'workflow', 'core', true, 1),

  ('workflow-progress', '워크플로우 진행', '워크플로우 진행 상황 조회',
   E'---\nname: workflow-progress\ndescription: 워크플로우 진행 상황 조회\n---\n\n# workflow-progress\n\n진행 중인 워크플로우의 현재 상태를 조회합니다.\n',
   'workflow', 'core', true, 2),

  ('workflow-resume', '워크플로우 재개', '중단된 워크플로우 재개',
   E'---\nname: workflow-resume\ndescription: 중단된 워크플로우 재개\n---\n\n# workflow-resume\n\n중단된 워크플로우를 재개합니다.\n',
   'workflow', 'core', true, 3);

-- Discovery (1개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('ideate', '아이디에이션', '아이디어 발굴 및 분석',
   E'---\nname: ideate\ndescription: 아이디어 발굴 및 분석\n---\n\n# ideate\n\n새로운 아이디어를 발굴하고 분석합니다.\n',
   'discovery', 'core', true, 10);

-- Planning (3개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('create-epic', 'Epic 생성', 'Epic 이슈 생성',
   E'---\nname: create-epic\ndescription: Epic 이슈 생성\n---\n\n# create-epic\n\nEpic 이슈를 생성합니다.\n',
   'planning', 'core', true, 20),

  ('design-user-flow', '사용자 흐름 설계', 'UX 사용자 흐름 다이어그램 설계',
   E'---\nname: design-user-flow\ndescription: UX 사용자 흐름 다이어그램 설계\n---\n\n# design-user-flow\n\n사용자 흐름을 설계합니다.\n',
   'planning', 'core', true, 21),

  ('generate-mockup', '목업 생성', 'UI 목업 생성',
   E'---\nname: generate-mockup\ndescription: UI 목업 생성\n---\n\n# generate-mockup\n\nUI 목업을 생성합니다.\n',
   'planning', 'core', true, 22);

-- Solutioning (4개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('scaffold-domain', '도메인 스캐폴딩', 'DDD 4-layer 도메인 구조 생성',
   E'---\nname: scaffold-domain\ndescription: DDD 4-layer 도메인 구조 생성\n---\n\n# scaffold-domain\n\nDDD 4-layer 도메인 구조를 생성합니다.\n',
   'solutioning', 'core', true, 30),

  ('validate-architecture', '아키텍처 검증', 'DDD 4-layer 아키텍처 준수 검증',
   E'---\nname: validate-architecture\ndescription: DDD 4-layer 아키텍처 준수 검증\n---\n\n# validate-architecture\n\n아키텍처 준수 여부를 검증합니다.\n',
   'solutioning', 'core', true, 31),

  ('generate-spec', '명세 생성', 'Speckit 워크플로우 통합 실행',
   E'---\nname: generate-spec\ndescription: Speckit 워크플로우 통합 실행\n---\n\n# generate-spec\n\n명세 문서를 생성합니다.\n',
   'solutioning', 'core', true, 32),

  ('design-tests', '테스트 설계', '구현 전 테스트 케이스 설계 (TDD)',
   E'---\nname: design-tests\ndescription: 구현 전 테스트 케이스 설계 (TDD)\n---\n\n# design-tests\n\n테스트 케이스를 설계합니다.\n',
   'solutioning', 'core', true, 33);

-- Implementation (6개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('create-sprint', '스프린트 생성', 'Sprint 목표 설정 및 시작',
   E'---\nname: create-sprint\ndescription: Sprint 목표 설정 및 시작\n---\n\n# create-sprint\n\n스프린트를 생성하고 시작합니다.\n',
   'implementation', 'core', true, 40),

  ('start-task', '태스크 시작', '작업 시작 (이슈 상태 변경, 브랜치 생성)',
   E'---\nname: start-task\ndescription: 작업 시작 (이슈 상태 변경, 브랜치 생성)\n---\n\n# start-task\n\n태스크를 시작합니다.\n',
   'implementation', 'core', true, 41),

  ('review-task', '태스크 리뷰', '태스크 이슈 기반 구현 완료 리뷰',
   E'---\nname: review-task\ndescription: 태스크 이슈 기반 구현 완료 리뷰\n---\n\n# review-task\n\n태스크 구현을 리뷰합니다.\n',
   'implementation', 'core', true, 42),

  ('write-code', '코드 작성', '코드 작성, 수정, 구현',
   E'---\nname: write-code\ndescription: 코드 작성, 수정, 구현\n---\n\n# write-code\n\n코드를 작성합니다.\n',
   'implementation', 'core', true, 43),

  ('run-code-review', '코드 리뷰', '프로젝트 통합 코드 리뷰',
   E'---\nname: run-code-review\ndescription: 프로젝트 통합 코드 리뷰\n---\n\n# run-code-review\n\n코드 리뷰를 실행합니다.\n',
   'implementation', 'core', true, 44),

  ('close-sprint', '스프린트 종료', 'Sprint 종료 및 회고 정리',
   E'---\nname: close-sprint\ndescription: Sprint 종료 및 회고 정리\n---\n\n# close-sprint\n\n스프린트를 종료합니다.\n',
   'implementation', 'core', true, 45);

-- Supporting (2개)
INSERT INTO semo.skills (name, display_name, description, content, category, package, is_required, install_order)
VALUES
  ('git-workflow', 'Git 워크플로우', 'Git 커밋/푸시/PR 자동화',
   E'---\nname: git-workflow\ndescription: Git 커밋/푸시/PR 자동화\n---\n\n# git-workflow\n\nGit 워크플로우를 자동화합니다.\n',
   'supporting', 'core', true, 50),

  ('notify-slack', 'Slack 알림', 'Slack 채널에 메시지 전송',
   E'---\nname: notify-slack\ndescription: Slack 채널에 메시지 전송\n---\n\n# notify-slack\n\nSlack에 알림을 전송합니다.\n',
   'supporting', 'core', true, 51);

-- =============================================================================
-- 시드 데이터: 커맨드
-- =============================================================================

INSERT INTO semo.commands (name, folder, content, description)
VALUES
  ('help', 'SEMO',
   E'# /SEMO:help\n\nSEMO 도움말을 표시합니다.\n\n## Usage\n\n```\n/SEMO:help\n```\n',
   'SEMO 도움말'),

  ('dry-run', 'SEMO',
   E'# /SEMO:dry-run\n\n명령을 실행하지 않고 라우팅 결과만 확인합니다.\n\n## Usage\n\n```\n/SEMO:dry-run {프롬프트}\n```\n',
   '명령 검증 (라우팅 시뮬레이션)'),

  ('greenfield', 'SEMO-workflow',
   E'# /SEMO-workflow:greenfield\n\nBMad Method Greenfield Workflow를 시작합니다.\n\n## Purpose\n\n새로운 프로젝트를 처음부터 구축하는 4-Phase 워크플로우입니다.\n\n```\nPhase 1: Discovery (Optional) - 아이디어 발굴 및 분석\nPhase 2: Planning (Required) - PRD/Epic 생성 및 UX 설계\nPhase 3: Solutioning (Required) - 아키텍처 및 명세 작성\nPhase 4: Implementation (Required) - 스프린트 기반 개발\n```\n\n## Usage\n\n```\n/SEMO-workflow:greenfield\n```\n',
   'Greenfield 워크플로우 시작');

-- =============================================================================
-- 시드 데이터: 에이전트
-- =============================================================================

INSERT INTO semo.agents (name, display_name, content, package, install_order)
VALUES
  ('orchestrator', 'Orchestrator',
   E'---\nname: orchestrator\ndescription: SEMO 메인 오케스트레이터\n---\n\n# Orchestrator Agent\n\n사용자 요청을 분석하고 적절한 Agent/Skill로 라우팅합니다.\n\n## Routing Table\n\n| Intent | Agent/Skill |\n|--------|-------------|\n| 코드 작성 | write-code |\n| Git 커밋 | git-workflow |\n| 테스트 작성 | write-test |\n',
   'core', 1);

-- =============================================================================
-- 시드 데이터: 패키지
-- =============================================================================

INSERT INTO semo.packages (name, display_name, description, layer, package_type, version, is_required, install_order)
VALUES
  ('semo-core', 'SEMO Core', '원칙, 오케스트레이터', 'standard', 'standard', '3.14.0', true, 10),
  ('semo-skills', 'SEMO Skills', '19개 핵심 스킬', 'standard', 'standard', '3.14.0', true, 20);

-- =============================================================================
-- 조회 함수
-- =============================================================================

-- 활성 스킬 목록 조회
CREATE OR REPLACE FUNCTION semo.get_active_skills()
RETURNS TABLE (
  name VARCHAR(100),
  content TEXT,
  category VARCHAR(50),
  install_order INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.name,
    s.content,
    s.category,
    s.install_order
  FROM semo.skills s
  WHERE s.is_active = true
  ORDER BY s.install_order;
END;
$$ LANGUAGE plpgsql;

-- 카테고리별 스킬 개수
CREATE OR REPLACE FUNCTION semo.get_skill_count_by_category()
RETURNS TABLE (
  category VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.category,
    COUNT(*)::BIGINT
  FROM semo.skills s
  WHERE s.is_active = true
  GROUP BY s.category
  ORDER BY MIN(s.install_order);
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE 'SEMO 스키마 생성 완료';
  RAISE NOTICE '- semo.skills: 19개 핵심 스킬';
  RAISE NOTICE '- semo.commands: 3개 커맨드';
  RAISE NOTICE '- semo.agents: 1개 에이전트';
  RAISE NOTICE '- semo.packages: 2개 패키지';
END $$;
