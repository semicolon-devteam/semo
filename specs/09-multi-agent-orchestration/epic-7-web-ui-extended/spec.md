# Multi-Agent Orchestration - Web UI Extended Specification

## Background

Epic 1-6에서 백엔드 인프라와 기본 UI를 구축했다.
이제 워크플로우 진행 상황 표시와 에이전트/스킬 정의 편집 UI를 구현해야 한다.

## Problem Statement

1. **워크플로우 진행 상황 불명확**: 사용자가 현재 워크플로우 진행 상황을 파악하기 어려움
2. **에이전트 정의 편집 불가**: 웹 UI에서 에이전트 정의를 수정할 수 없음
3. **스킬 관리 불가**: 웹 UI에서 스킬을 조회/수정할 수 없음
4. **결과물 확인 어려움**: 워크플로우 단계별 결과물을 한눈에 확인하기 어려움

## Goals & Non-goals

### Goals
- **Primary**: 워크플로우 진행 상황 표시 UI (`WorkflowProgress`)
- **Secondary**: 에이전트/스킬 정의 편집 UI (`AgentDefinitionEditor`, `SkillDefinitionEditor`)

### Non-goals
- 복잡한 마크다운 에디터 (외부 라이브러리 활용)
- 에이전트 생성 UI (초기에는 수정만 지원)

## User Stories

### US1: 사용자가 워크플로우 진행 상황을 확인한다
**As a** Office 사용자
**I want to** 현재 실행 중인 워크플로우의 단계별 진행 상황 확인
**So that** 작업이 어디까지 진행되었는지 파악할 수 있다

### US2: 사용자가 단계별 결과물을 확인한다
**As a** Office 사용자
**I want to** 각 단계의 결과물(산출물)을 미리보기
**So that** 중간 결과를 확인하고 필요 시 개입할 수 있다

### US3: 관리자가 에이전트 정의를 수정한다
**As a** Office 관리자
**I want to** 웹 UI에서 에이전트 정의(마크다운)를 편집
**So that** 에이전트 동작을 커스터마이징할 수 있다

### US4: 관리자가 스킬 정의를 수정한다
**As a** Office 관리자
**I want to** 웹 UI에서 스킬 정의를 편집
**So that** 스킬 동작을 커스터마이징할 수 있다

## Technical Constraints

### 기술 스택
- React 18+
- Supabase Realtime
- Monaco Editor 또는 CodeMirror (마크다운 편집)
- TypeScript

### 성능 요구사항
- 워크플로우 상태 업데이트 실시간 반영 (< 500ms)
- 에이전트 정의 저장 시 즉시 반영

## Acceptance Criteria

- [ ] `useWorkflowProgress` 훅 구현
- [ ] `WorkflowProgress` 컴포넌트 구현
- [ ] 단계 진행 그래프 (완료/진행중/대기)
- [ ] 현재 단계 상세 정보 표시
- [ ] 결과물 미리보기 모달
- [ ] `AgentDefinitionEditor` 컴포넌트 구현
- [ ] 마크다운 에디터 통합
- [ ] Frontmatter 파서/생성기
- [ ] 저장 API 연동
- [ ] `SkillDefinitionEditor` 컴포넌트 구현
- [ ] SKILL.md + references 편집 지원
