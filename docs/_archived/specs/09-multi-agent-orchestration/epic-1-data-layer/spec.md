# Multi-Agent Orchestration - Data Layer Specification

## Background

SEMO Office는 GatherTown 스타일의 가상 오피스에서 멀티 에이전트 협업 시스템을 구축하고 있다.
현재 에이전트 정의는 파일 시스템(.claude/agents/)에 하드코딩되어 있으며, 런타임에 동적으로 변경할 수 없다.

## Problem Statement

1. **에이전트 정의 관리 어려움**: 각 Office마다 다른 에이전트 설정을 적용하기 어렵다
2. **스킬 커스터마이징 불가**: Office별로 다른 스킬 세트를 제공할 수 없다
3. **실시간 협업 지원 부재**: 에이전트 간 통신, 사용자 질문, 워크플로우 상태를 추적할 DB 구조가 없다

## Goals & Non-goals

### Goals
- **Primary**: 에이전트/스킬 정의를 DB에 저장하여 Office별 커스터마이징 지원
- **Secondary**: 에이전트 간 통신, 사용자 질문, 워크플로우를 위한 DB 스키마 구축

### Non-goals
- 이 Epic에서는 DB → 파일 동기화 로직 구현하지 않음 (Epic 2에서 구현)
- API 엔드포인트 구현하지 않음 (Epic 2에서 구현)

## User Stories

### US1: Office 관리자가 에이전트 정의를 저장한다
**As a** Office 관리자
**I want to** 에이전트 정의(.md 전체 내용)를 DB에 저장
**So that** Office별로 다른 에이전트 구성을 적용할 수 있다

### US2: 시스템이 기본 에이전트 템플릿을 제공한다
**As a** 새 Office 생성자
**I want to** 기본 에이전트/스킬 템플릿이 자동으로 복사되길
**So that** 처음부터 설정하지 않아도 바로 시작할 수 있다

### US3: 에이전트가 다른 에이전트에게 결과물을 전달한다
**As an** Orchestrator 에이전트
**I want to** 다른 에이전트의 작업 결과를 DB에서 조회
**So that** 워크플로우 다음 단계로 진행할 수 있다

## Technical Constraints

### 기술 스택
- PostgreSQL (Supabase)
- Row Level Security (RLS) 적용 필수
- UUID를 Primary Key로 사용

### 데이터 무결성
- `office_id` 기반 CASCADE DELETE
- 에이전트 이름은 Office 내에서 UNIQUE

## Acceptance Criteria

- [ ] `agent_definitions` 테이블 생성 (office_id, name, role, definition_content, frontmatter JSONB)
- [ ] `skill_definitions` 테이블 생성 (office_id, name, skill_content, references JSONB)
- [ ] `default_agent_templates` 테이블 생성 (기본 템플릿 저장)
- [ ] `default_skill_templates` 테이블 생성 (기본 스킬 템플릿 저장)
- [ ] `user_questions` 테이블 생성 (에이전트 → 사용자 질문)
- [ ] `agent_results` 테이블 생성 (에이전트 간 결과물 전달)
- [ ] `agent_invocations` 테이블 생성 (에이전트 호출 기록)
- [ ] `workflow_instances` 테이블 생성 (워크플로우 실행 인스턴스)
- [ ] `workflow_step_executions` 테이블 생성 (단계별 실행 기록)
- [ ] `agent_task_queue` 테이블 생성 (작업 대기열)
- [ ] 모든 테이블에 RLS 정책 적용
- [ ] 6개 기본 에이전트 템플릿 시드 데이터 (Orchestrator, PO, PM, FE, BE, QA)
- [ ] 3개 기본 스킬 템플릿 시드 데이터 (write-code, git-workflow, ask-user)
