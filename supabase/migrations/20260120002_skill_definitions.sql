-- =============================================================================
-- Fix: skill_definitions 테이블 재생성
--
-- 기존 테이블이 다른 스키마로 존재하여 DROP 후 재생성합니다.
-- =============================================================================

-- 기존 테이블 및 함수 삭제
DROP FUNCTION IF EXISTS get_active_skills();
DROP FUNCTION IF EXISTS get_skill_count_by_category();
DROP TABLE IF EXISTS skill_definitions CASCADE;

-- 테이블 재생성
CREATE TABLE skill_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 스킬 식별
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 분류
  category VARCHAR(50) NOT NULL DEFAULT 'core',

  -- 소스 경로 (semo-system 기준)
  source_path VARCHAR(200) NOT NULL,

  -- 설치 제어
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  install_order INT NOT NULL DEFAULT 100,

  -- 의존성
  depends_on TEXT[] DEFAULT '{}',

  -- 버전
  version VARCHAR(20) DEFAULT '1.0.0',

  -- 메타데이터
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_skill_definitions_category ON skill_definitions(category);
CREATE INDEX idx_skill_definitions_active ON skill_definitions(is_active);

-- -----------------------------------------------------------------------------
-- BMad Greenfield 필수 스킬 데이터 (19개)
-- -----------------------------------------------------------------------------

-- Workflow Management (3개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('workflow-start', '워크플로우 시작', '워크플로우 인스턴스 생성 및 시작', 'workflow', 'semo-skills/workflow-start', true, 1, '1.0.0'),
  ('workflow-progress', '워크플로우 진행', '워크플로우 진행 상황 조회', 'workflow', 'semo-skills/workflow-progress', true, 2, '1.0.0'),
  ('workflow-resume', '워크플로우 재개', '중단된 워크플로우 재개', 'workflow', 'semo-skills/workflow-resume', true, 3, '1.0.0');

-- Discovery Phase (1개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('ideate', '아이디에이션', '아이디어 발굴 및 분석', 'discovery', 'semo-skills/ideate', true, 10, '1.0.0');

-- Planning Phase (3개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('create-epic', 'Epic 생성', 'Epic 이슈 생성', 'planning', 'semo-skills/create-epic', true, 20, '1.0.0'),
  ('design-user-flow', '사용자 흐름 설계', 'UX 사용자 흐름 다이어그램 설계', 'planning', 'semo-skills/design-user-flow', true, 21, '1.0.0'),
  ('generate-mockup', '목업 생성', 'UI 목업 생성', 'planning', 'semo-skills/generate-mockup', true, 22, '1.0.0');

-- Solutioning Phase (4개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('scaffold-domain', '도메인 스캐폴딩', 'DDD 4-layer 도메인 구조 생성', 'solutioning', 'semo-skills/scaffold-domain', true, 30, '1.0.0'),
  ('validate-architecture', '아키텍처 검증', 'DDD 4-layer 아키텍처 준수 검증', 'solutioning', 'semo-skills/validate-architecture', true, 31, '1.0.0'),
  ('generate-spec', '명세 생성', 'Speckit 워크플로우 통합 실행', 'solutioning', 'semo-skills/generate-spec', true, 32, '1.0.0'),
  ('design-tests', '테스트 설계', '구현 전 테스트 케이스 설계 (TDD)', 'solutioning', 'semo-skills/design-tests', true, 33, '1.0.0');

-- Implementation Phase (6개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('create-sprint', '스프린트 생성', 'Sprint(Iteration) 목표 설정 및 시작', 'implementation', 'semo-skills/create-sprint', true, 40, '1.0.0'),
  ('start-task', '태스크 시작', '작업 시작 (이슈 상태 변경, 브랜치 생성)', 'implementation', 'semo-skills/start-task', true, 41, '1.0.0'),
  ('review-task', '태스크 리뷰', 'GitHub 태스크 이슈 기반 구현 완료 리뷰', 'implementation', 'semo-skills/review-task', true, 42, '1.0.0'),
  ('write-code', '코드 작성', '코드 작성, 수정, 구현', 'implementation', 'semo-skills/write-code', true, 43, '1.0.0'),
  ('run-code-review', '코드 리뷰', 'Next.js 프로젝트 통합 리뷰', 'implementation', 'semo-skills/run-code-review', true, 44, '1.0.0'),
  ('close-sprint', '스프린트 종료', 'Sprint(Iteration) 종료 및 회고 정리', 'implementation', 'semo-skills/close-sprint', true, 45, '1.0.0');

-- Supporting Skills (2개)
INSERT INTO skill_definitions (name, display_name, description, category, source_path, is_required, install_order, version)
VALUES
  ('git-workflow', 'Git 워크플로우', 'Git 커밋/푸시/PR 자동화', 'supporting', 'semo-skills/git-workflow', true, 50, '1.0.0'),
  ('notify-slack', 'Slack 알림', 'Slack 채널에 메시지 전송', 'supporting', 'semo-skills/notify-slack', true, 51, '1.0.0');

-- -----------------------------------------------------------------------------
-- 조회 함수
-- -----------------------------------------------------------------------------

-- 활성 스킬 목록 조회
CREATE OR REPLACE FUNCTION get_active_skills()
RETURNS TABLE (
  name VARCHAR(100),
  source_path VARCHAR(200),
  category VARCHAR(50),
  install_order INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.name,
    sd.source_path,
    sd.category,
    sd.install_order
  FROM skill_definitions sd
  WHERE sd.is_active = true
  ORDER BY sd.install_order;
END;
$$ LANGUAGE plpgsql;

-- 카테고리별 스킬 개수
CREATE OR REPLACE FUNCTION get_skill_count_by_category()
RETURNS TABLE (
  category VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.category,
    COUNT(*)::BIGINT
  FROM skill_definitions sd
  WHERE sd.is_active = true
  GROUP BY sd.category
  ORDER BY MIN(sd.install_order);
END;
$$ LANGUAGE plpgsql;
