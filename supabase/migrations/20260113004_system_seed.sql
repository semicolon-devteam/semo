-- =============================================================================
-- SEMO Office - System Seed Data
-- =============================================================================
--
-- 시스템 스킬, 에이전트, 워크플로우 시드 데이터
-- Phase 2: 55 Skill + 11 Agent + 6 Workflow
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 시스템 스킬 시드 (55개 중 핵심 스킬)
-- -----------------------------------------------------------------------------

-- 코드 관련 스킬
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- write-code
('write-code',
 '코드 작성, 수정, 구현. Use when (1) "코드 작성해줘", "구현해줘", (2) 기능 추가/수정, (3) 버그 수정.',
 'semo-skills', 'code', 'skill',
 ARRAY['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
 '[{"type": "keyword", "patterns": ["코드 작성", "구현", "개발", "코딩"]}]'::jsonb,
 '# Write Code Skill

코드를 작성하고 수정하는 핵심 스킬입니다.

## 작업 흐름
1. 요구사항 분석
2. 코드 작성/수정
3. 품질 검증 제안',
 true, '2.0.0'),

-- typescript-write
('typescript-write',
 'Semicolon 팀 표준 기반 TypeScript/React 코드 작성.',
 'semo-skills', 'code', 'skill',
 ARRAY['Read', 'Write', 'Edit', 'Glob', 'Grep'],
 '[{"type": "keyword", "patterns": ["타입스크립트", "TypeScript", "TS 코드"]}]'::jsonb,
 '# TypeScript Write Skill

팀 표준에 맞는 TypeScript 코드를 작성합니다.',
 true, '2.0.0'),

-- analyze-code
('analyze-code',
 '코드 종합 분석 (품질/보안/성능/아키텍처).',
 'semo-skills', 'code', 'skill',
 ARRAY['Read', 'Glob', 'Grep'],
 '[{"type": "keyword", "patterns": ["코드 분석", "리뷰", "검토"]}]'::jsonb,
 '# Analyze Code Skill

코드의 품질, 보안, 성능을 분석합니다.',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- 테스트 관련 스킬
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- write-test
('write-test',
 '테스트 코드 작성 및 실행. Use when (1) "테스트 작성해줘", (2) "테스트 실행해줘", (3) 테스트 커버리지 확인.',
 'semo-skills', 'test', 'skill',
 ARRAY['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
 '[{"type": "keyword", "patterns": ["테스트 작성", "테스트 코드", "유닛 테스트"]}]'::jsonb,
 '# Write Test Skill

테스트 코드를 작성하고 실행합니다.',
 true, '2.0.0'),

-- run-tests
('run-tests',
 '테스트 실행 및 품질 검증.',
 'semo-skills', 'test', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "keyword", "patterns": ["테스트 실행", "npm test"]}]'::jsonb,
 '# Run Tests Skill

테스트를 실행하고 결과를 분석합니다.',
 true, '2.0.0'),

-- e2e-test
('e2e-test',
 'Playwright E2E 테스트 실행.',
 'semo-skills', 'test', 'skill',
 ARRAY['Bash', 'Read', 'Playwright MCP'],
 '[{"type": "keyword", "patterns": ["E2E 테스트", "런타임 테스트", "브라우저 테스트"]}]'::jsonb,
 '# E2E Test Skill

Playwright를 사용한 End-to-End 테스트를 실행합니다.',
 true, '2.0.0'),

-- quality-gate
('quality-gate',
 '코드 품질 검증 스킬. Use when (1) 커밋 전 검증, (2) 린트/빌드/테스트 실행, (3) PR 전 품질 확인.',
 'semo-skills', 'test', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "keyword", "patterns": ["품질 검증", "린트", "빌드 체크"]}]'::jsonb,
 '# Quality Gate Skill

ESLint, TypeScript, Build, Test를 순차 실행합니다.',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- Git/배포 관련 스킬
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- git-workflow
('git-workflow',
 'Git 워크플로우 자동화. Use when (1) "커밋해줘", "푸시해줘", (2) "PR 만들어줘", (3) "브랜치 만들어줘".',
 'semo-skills', 'git', 'skill',
 ARRAY['Bash', 'GitHub CLI'],
 '[{"type": "keyword", "patterns": ["커밋", "푸시", "PR", "브랜치"]}]'::jsonb,
 '# Git Workflow Skill

Git 커밋, 푸시, PR 생성을 자동화합니다.',
 true, '2.0.0'),

-- deploy-service
('deploy-service',
 'Docker/SSH 기반 마이크로서비스 직접 배포.',
 'semo-skills', 'deploy', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "keyword", "patterns": ["배포", "deploy", "서비스 배포"]}]'::jsonb,
 '# Deploy Service Skill

마이크로서비스를 배포합니다.',
 true, '2.0.0'),

-- trigger-deploy
('trigger-deploy',
 'GitHub Actions 기반 프로젝트 배포 (Milestone Close → CI/CD 트리거).',
 'semo-skills', 'deploy', 'skill',
 ARRAY['Bash', 'GitHub CLI'],
 '[{"type": "keyword", "patterns": ["배포 트리거", "릴리스", "stg 배포", "prd 배포"]}]'::jsonb,
 '# Trigger Deploy Skill

GitHub Actions를 통한 배포를 트리거합니다.',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- 프로젝트 관리 스킬 (GitHub 대체)
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- create-feedback-issue (Supabase 버전)
('create-feedback-issue',
 'SEMO 패키지 피드백 수집 및 이슈 생성.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["피드백", "이슈 생성", "버그 리포트"]}]'::jsonb,
 '# Create Feedback Issue Skill (Supabase)

Supabase issues 테이블에 피드백 이슈를 생성합니다.

## 사용법
```sql
SELECT create_feedback_issue(
  p_office_id,
  ''이슈 제목'',
  ''이슈 내용'',
  ''패키지명'',
  ARRAY[''label1'', ''label2'']
);
```',
 true, '2.0.0'),

-- list-bugs (Supabase 버전)
('list-bugs',
 'Supabase 기반 버그 이슈 조회.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["버그 목록", "버그 확인", "버그 조회"]}]'::jsonb,
 '# List Bugs Skill (Supabase)

Supabase bug_list 뷰에서 버그를 조회합니다.

## 사용법
```sql
SELECT * FROM bug_list WHERE office_id = ''...'';
```',
 true, '2.0.0'),

-- project-status (Supabase 버전)
('project-status',
 'Supabase 기반 이슈 상태 변경.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["상태 변경", "Status 바꿔"]}]'::jsonb,
 '# Project Status Skill (Supabase)

Supabase issues 테이블의 상태를 변경합니다.

## 사용법
```sql
SELECT update_issue_status(
  p_issue_id,
  ''in_progress'',
  p_changed_by_id,
  ''변경자 이름'',
  ''변경 사유''
);
```',
 true, '2.0.0'),

-- assign-task (Supabase 버전)
('assign-task',
 'Supabase 기반 이슈 할당 및 작업량 산정.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["할당", "담당자", "작업량"]}]'::jsonb,
 '# Assign Task Skill (Supabase)

이슈에 담당자를 할당하고 작업량을 산정합니다.',
 true, '2.0.0'),

-- start-task (Supabase 버전)
('start-task',
 'Supabase 기반 작업 시작.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase', 'Bash'],
 '[{"type": "keyword", "patterns": ["작업 시작", "시작하자"]}]'::jsonb,
 '# Start Task Skill (Supabase)

이슈 상태를 in_progress로 변경하고 브랜치를 생성합니다.',
 true, '2.0.0'),

-- task-progress (Supabase 버전)
('task-progress',
 'Supabase 기반 작업 진행도 추적.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["진행도", "진행 상황"]}]'::jsonb,
 '# Task Progress Skill (Supabase)

작업 진행도를 추적하고 상태를 업데이트합니다.',
 true, '2.0.0'),

-- check-feedback (Supabase 버전)
('check-feedback',
 'Supabase 기반 피드백 이슈 조회.',
 'semo-skills', 'project', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["피드백 확인", "피드백 있는지"]}]'::jsonb,
 '# Check Feedback Skill (Supabase)

Supabase에서 피드백 이슈를 조회합니다.',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- 회의/문서 스킬 (GitHub Discussion 대체)
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- summarize-meeting (Supabase 버전)
('summarize-meeting',
 'Supabase 기반 회의 녹취록 분석 및 회의록 생성.',
 'semo-skills', 'doc', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["회의록", "녹취록 요약"]}]'::jsonb,
 '# Summarize Meeting Skill (Supabase)

회의 녹취록을 분석하여 discussions 테이블에 회의록을 생성합니다.

## 저장 위치
- category: ''meeting-minutes''',
 true, '2.0.0'),

-- create-meeting-minutes (Supabase 버전)
('create-meeting-minutes',
 'Supabase 기반 정기 회의록 생성.',
 'semo-skills', 'doc', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["정기 회의록", "회의록 생성"]}]'::jsonb,
 '# Create Meeting Minutes Skill (Supabase)

discussions 테이블에 정기 회의록을 생성합니다.',
 true, '2.0.0'),

-- create-decision-log (Supabase 버전)
('create-decision-log',
 'Supabase 기반 의사결정 로그 생성.',
 'semo-skills', 'doc', 'skill',
 ARRAY['Read', 'Supabase'],
 '[{"type": "keyword", "patterns": ["의사결정", "결정 로그", "ADR"]}]'::jsonb,
 '# Create Decision Log Skill (Supabase)

discussions 테이블에 의사결정 로그를 생성합니다.

## 저장 위치
- category: ''decision-log''',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- 알림/유틸리티 스킬
INSERT INTO skill_definitions (name, description, package, category, skill_type, tools, triggers, prompt, is_system, version)
VALUES
-- notify-slack
('notify-slack',
 'Slack 채널에 메시지 전송.',
 'semo-skills', 'notify', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "keyword", "patterns": ["슬랙 알림", "Slack 전송"]}]'::jsonb,
 '# Notify Slack Skill

Slack API를 통해 메시지를 전송합니다.',
 true, '2.0.1'),

-- circuit-breaker
('circuit-breaker',
 '무한 루프 및 토큰 폭주 방지 서킷 브레이커.',
 'semo-skills', 'utility', 'skill',
 ARRAY['Read'],
 '[{"type": "event", "patterns": ["loop_detected", "token_overflow"]}]'::jsonb,
 '# Circuit Breaker Skill

무한 루프와 토큰 폭주를 방지합니다.',
 true, '2.0.0'),

-- health-check
('health-check',
 '개발 환경 및 인증 상태 자동 검증.',
 'semo-skills', 'utility', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "keyword", "patterns": ["헬스 체크", "상태 확인", "환경 확인"]}]'::jsonb,
 '# Health Check Skill

개발 환경과 인증 상태를 검증합니다.',
 true, '2.0.0'),

-- version-updater
('version-updater',
 'SEMO 패키지 버전 체크 및 업데이트 알림.',
 'semo-skills', 'utility', 'skill',
 ARRAY['Bash', 'Read'],
 '[{"type": "event", "patterns": ["session_start"]}]'::jsonb,
 '# Version Updater Skill

새 세션 시작 시 버전을 체크합니다.',
 true, '2.0.0'),

-- semo-help
('semo-help',
 'SEMO 도움말 및 Semicolon 팀 컨텍스트 응답.',
 'semo-skills', 'utility', 'skill',
 ARRAY['Read'],
 '[{"type": "keyword", "patterns": ["도움말", "SEMO란", "어떻게 해"]}]'::jsonb,
 '# SEMO Help Skill

SEMO 사용법과 도움말을 제공합니다.',
 true, '2.0.0'),

-- routing-map
('routing-map',
 'SEMO 라우팅 구조 시각화.',
 'semo-skills', 'utility', 'skill',
 ARRAY['Read'],
 '[{"type": "command", "patterns": ["/SEMO:routing-map"]}]'::jsonb,
 '# Routing Map Skill

SEMO의 라우팅 구조를 시각화합니다.',
 true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  tools = EXCLUDED.tools,
  triggers = EXCLUDED.triggers,
  prompt = EXCLUDED.prompt,
  version = EXCLUDED.version;

-- -----------------------------------------------------------------------------
-- 2. 시스템 에이전트 시드 (11개)
-- -----------------------------------------------------------------------------

INSERT INTO agent_definitions (name, role, description, package, persona_prompt, scope_patterns, core_skills, routing_rules, is_system, version)
VALUES
-- orchestrator
('orchestrator',
 'orchestrator',
 '모든 요청을 분석하고 적절한 Agent/Skill로 라우팅하는 오케스트레이터.',
 'semo-core',
 '# Orchestrator Agent

당신은 SEMO의 중앙 오케스트레이터입니다.

## 역할
- 사용자 요청을 분석합니다
- 적절한 Agent 또는 Skill로 라우팅합니다
- 복합 작업은 Agent에게, 단순 작업은 Skill에 직접 라우팅합니다

## 라우팅 원칙
1. 의도 분석 → 카테고리 분류
2. 복잡도 판단 → Agent vs Skill 결정
3. 전문성 매칭 → 최적 담당자 선택',
 ARRAY['**/*'],
 '[{"name": "route_to_agent", "priority": 1}]'::jsonb,
 '{"priority": 100, "keywords": ["모든 요청"]}'::jsonb,
 true, '4.0.0'),

-- architect
('architect',
 'architect',
 '시스템 아키텍처 설계 및 기술 방향 제시.',
 'semo-core',
 '# Architect Agent

당신은 소프트웨어 아키텍트입니다.

## 역할
- DDD 4-layer 아키텍처 설계
- 기술 스택 결정
- 아키텍처 결정 기록(ADR) 작성',
 ARRAY['src/lib/**', 'docs/architecture/**', '**/types/**'],
 '[{"name": "scaffold-domain", "priority": 1}, {"name": "validate-architecture", "priority": 2}, {"name": "create-decision-log", "priority": 3}]'::jsonb,
 '{"priority": 80, "keywords": ["아키텍처", "설계", "구조"]}'::jsonb,
 true, '4.0.0'),

-- backend
('backend',
 'backend',
 '백엔드 API 개발 및 데이터베이스 관리.',
 'semo-core',
 '# Backend Agent

당신은 백엔드 개발자입니다.

## 역할
- RESTful API 설계 및 구현
- 데이터베이스 스키마 관리
- Supabase/Prisma 연동',
 ARRAY['src/api/**', 'src/server/**', 'prisma/**', 'supabase/**'],
 '[{"name": "write-code", "priority": 1}, {"name": "migrate-db", "priority": 2}, {"name": "supabase-typegen", "priority": 3}]'::jsonb,
 '{"priority": 70, "keywords": ["API", "백엔드", "서버", "DB"]}'::jsonb,
 true, '4.0.0'),

-- frontend
('frontend',
 'frontend',
 '프론트엔드 UI/UX 개발.',
 'semo-core',
 '# Frontend Agent

당신은 프론트엔드 개발자입니다.

## 역할
- React/Next.js 컴포넌트 개발
- UI/UX 구현
- 디자인 시스템 적용',
 ARRAY['src/app/**', 'src/components/**', 'src/styles/**'],
 '[{"name": "typescript-write", "priority": 1}, {"name": "frontend-design", "priority": 2}]'::jsonb,
 '{"priority": 70, "keywords": ["프론트엔드", "UI", "컴포넌트", "화면"]}'::jsonb,
 true, '4.0.0'),

-- dev
('dev',
 'dev',
 '범용 개발 작업 수행.',
 'semo-core',
 '# Dev Agent

당신은 범용 개발자입니다.

## 역할
- 플랫폼 무관 코드 작성
- 버그 수정
- 리팩토링',
 ARRAY['src/**'],
 '[{"name": "write-code", "priority": 1}, {"name": "analyze-code", "priority": 2}]'::jsonb,
 '{"priority": 60, "keywords": ["개발", "코드", "구현"]}'::jsonb,
 true, '4.0.0'),

-- qa
('qa',
 'qa',
 '품질 보증 및 테스트.',
 'semo-core',
 '# QA Agent

당신은 QA 엔지니어입니다.

## 역할
- 테스트 설계 및 실행
- 버그 탐지
- 품질 검증',
 ARRAY['tests/**', 'e2e/**', '__tests__/**'],
 '[{"name": "write-test", "priority": 1}, {"name": "run-tests", "priority": 2}, {"name": "e2e-test", "priority": 3}]'::jsonb,
 '{"priority": 70, "keywords": ["테스트", "QA", "품질", "버그"]}'::jsonb,
 true, '4.0.0'),

-- devops
('devops',
 'devops',
 '배포 및 인프라 관리.',
 'semo-core',
 '# DevOps Agent

당신은 DevOps 엔지니어입니다.

## 역할
- CI/CD 파이프라인 관리
- 배포 자동화
- 인프라 모니터링',
 ARRAY['.github/workflows/**', 'docker/**', 'Dockerfile'],
 '[{"name": "deploy-service", "priority": 1}, {"name": "trigger-deploy", "priority": 2}, {"name": "health-check", "priority": 3}]'::jsonb,
 '{"priority": 70, "keywords": ["배포", "인프라", "CI/CD"]}'::jsonb,
 true, '4.0.0'),

-- po
('po',
 'po',
 'Product Owner - 요구사항 관리 및 기획.',
 'semo-core',
 '# PO Agent

당신은 Product Owner입니다.

## 역할
- 요구사항 분석
- Epic/태스크 생성
- 스프린트 계획',
 ARRAY['docs/**', '.github/ISSUE_TEMPLATE/**'],
 '[{"name": "create-epic", "priority": 1}, {"name": "create-sprint", "priority": 2}, {"name": "estimate-epic-timeline", "priority": 3}]'::jsonb,
 '{"priority": 80, "keywords": ["기획", "요구사항", "Epic", "스프린트"]}'::jsonb,
 true, '4.0.0'),

-- sm
('sm',
 'sm',
 'Scrum Master - 팀 조율 및 진행 관리.',
 'semo-core',
 '# SM Agent

당신은 Scrum Master입니다.

## 역할
- 스프린트 진행 관리
- 팀 협업 조율
- 회고 진행',
 ARRAY['docs/project/**'],
 '[{"name": "task-progress", "priority": 1}, {"name": "summarize-meeting", "priority": 2}, {"name": "close-sprint", "priority": 3}]'::jsonb,
 '{"priority": 70, "keywords": ["진행", "스크럼", "회고", "미팅"]}'::jsonb,
 true, '4.0.0'),

-- agent-manager (Meta)
('agent-manager',
 'agent-manager',
 'SEMO 에이전트 생성 및 관리.',
 'meta',
 '# Agent Manager Agent

당신은 SEMO 에이전트 관리자입니다.

## 역할
- 새 에이전트 생성
- 기존 에이전트 수정
- 에이전트 품질 감사',
 ARRAY['semo-system/**'],
 '[{"name": "skill-creator", "priority": 1}]'::jsonb,
 '{"priority": 90, "keywords": ["에이전트 생성", "스킬 생성"]}'::jsonb,
 true, '0.58.0'),

-- semo-architect (Meta)
('semo-architect',
 'semo-architect',
 'SEMO 프레임워크 아키텍처 설계.',
 'meta',
 '# SEMO Architect Agent

당신은 SEMO 프레임워크 아키텍트입니다.

## 역할
- SEMO 아키텍처 결정
- 패키지 구조 설계
- 프레임워크 확장 계획',
 ARRAY['semo-system/**'],
 '[{"name": "semo-architecture-checker", "priority": 1}]'::jsonb,
 '{"priority": 90, "keywords": ["SEMO 아키텍처", "프레임워크 설계"]}'::jsonb,
 true, '0.58.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  persona_prompt = EXCLUDED.persona_prompt,
  core_skills = EXCLUDED.core_skills,
  routing_rules = EXCLUDED.routing_rules,
  version = EXCLUDED.version;

-- -----------------------------------------------------------------------------
-- 3. 시스템 워크플로우 시드 (6개)
-- -----------------------------------------------------------------------------

INSERT INTO workflow_definitions (name, description, package, workflow_type, steps, triggers, is_system, is_active, version)
VALUES
-- release-workflow
('release-workflow',
 'Milestone 확인 → STG 배포 → PRD 태깅 → 알림',
 'semo-skills',
 'sequential',
 '[
   {"name": "milestone-check", "order": 1, "skill": "trigger-deploy", "description": "Milestone 상태 확인"},
   {"name": "stg-deploy", "order": 2, "skill": "deploy-service", "description": "STG 환경 배포"},
   {"name": "prd-tag", "order": 3, "skill": "trigger-deploy", "description": "PRD 태깅"},
   {"name": "notify", "order": 4, "skill": "notify-slack", "description": "배포 알림"}
 ]'::jsonb,
 '[{"type": "command", "patterns": ["/release", "릴리스"]}]'::jsonb,
 true, true, '2.0.0'),

-- quality-gate-workflow
('quality-gate-workflow',
 'ESLint → TypeScript → Build → Test',
 'semo-skills',
 'sequential',
 '[
   {"name": "lint", "order": 1, "skill": "quality-gate", "description": "ESLint 검사", "command": "npm run lint"},
   {"name": "typecheck", "order": 2, "skill": "quality-gate", "description": "TypeScript 타입 체크", "command": "npx tsc --noEmit"},
   {"name": "build", "order": 3, "skill": "quality-gate", "description": "빌드 검증", "command": "npm run build"},
   {"name": "test", "order": 4, "skill": "run-tests", "description": "테스트 실행", "command": "npm test"}
 ]'::jsonb,
 '[{"type": "event", "patterns": ["pre_commit", "pre_push"]}]'::jsonb,
 true, true, '2.0.0'),

-- generate-spec-workflow
('generate-spec-workflow',
 'specify → plan → tasks → issues',
 'semo-skills',
 'sequential',
 '[
   {"name": "specify", "order": 1, "skill": "generate-spec", "description": "요구사항 명세"},
   {"name": "plan", "order": 2, "skill": "create-impl-plan", "description": "구현 계획 수립"},
   {"name": "tasks", "order": 3, "skill": "create-epic", "description": "태스크 분해"},
   {"name": "issues", "order": 4, "skill": "assign-task", "description": "이슈 생성 및 할당"}
 ]'::jsonb,
 '[{"type": "keyword", "patterns": ["명세 작성", "스펙 생성"]}]'::jsonb,
 true, true, '2.0.0'),

-- ideate-workflow
('ideate-workflow',
 '아이디어 분석 → 검증 → Epic 생성',
 'semo-skills',
 'sequential',
 '[
   {"name": "analyze", "order": 1, "skill": "explore-approach", "description": "아이디어 분석"},
   {"name": "validate", "order": 2, "skill": "analyze-code", "description": "기술 검증"},
   {"name": "create-epic", "order": 3, "skill": "create-epic", "description": "Epic 생성"}
 ]'::jsonb,
 '[{"type": "keyword", "patterns": ["아이디어", "새 기능"]}]'::jsonb,
 true, true, '2.0.0'),

-- meta-workflow
('meta-workflow',
 'semo-system/ 수정 감지 → 버저닝 → 배포 → 동기화',
 'meta',
 'sequential',
 '[
   {"name": "detect", "order": 1, "description": "변경 감지"},
   {"name": "version", "order": 2, "skill": "version-manager", "description": "버전 범프"},
   {"name": "push", "order": 3, "skill": "git-workflow", "description": "git push"},
   {"name": "notify", "order": 4, "skill": "notify-slack", "description": "Slack 알림"},
   {"name": "sync", "order": 5, "description": "심볼릭 링크 동기화"}
 ]'::jsonb,
 '[{"type": "file_change", "patterns": ["semo-system/**"]}]'::jsonb,
 true, true, '0.58.0'),

-- code-complete-workflow
('code-complete-workflow',
 '코드 작성 → 테스트 → 검증 → 커밋',
 'semo-skills',
 'sequential',
 '[
   {"name": "write", "order": 1, "skill": "write-code", "description": "코드 작성"},
   {"name": "test", "order": 2, "skill": "write-test", "description": "테스트 작성"},
   {"name": "verify", "order": 3, "skill": "quality-gate", "description": "품질 검증"},
   {"name": "commit", "order": 4, "skill": "git-workflow", "description": "커밋"}
 ]'::jsonb,
 '[{"type": "suggestion", "patterns": ["코드 완료"]}]'::jsonb,
 true, true, '2.0.0')

ON CONFLICT (name, office_id) DO UPDATE SET
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  triggers = EXCLUDED.triggers,
  workflow_type = EXCLUDED.workflow_type,
  version = EXCLUDED.version;

-- -----------------------------------------------------------------------------
-- 완료 메시지
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_skill_count INT;
  v_agent_count INT;
  v_workflow_count INT;
BEGIN
  SELECT COUNT(*) INTO v_skill_count FROM skill_definitions WHERE is_system = true;
  SELECT COUNT(*) INTO v_agent_count FROM agent_definitions WHERE is_system = true;
  SELECT COUNT(*) INTO v_workflow_count FROM workflow_definitions WHERE is_system = true;

  RAISE NOTICE '시스템 시드 데이터 생성 완료';
  RAISE NOTICE '- 시스템 스킬: % 개', v_skill_count;
  RAISE NOTICE '- 시스템 에이전트: % 개', v_agent_count;
  RAISE NOTICE '- 시스템 워크플로우: % 개', v_workflow_count;
END;
$$;
