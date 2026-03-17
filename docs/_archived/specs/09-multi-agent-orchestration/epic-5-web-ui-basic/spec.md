# Multi-Agent Orchestration - Web UI Basic Specification

## Background

Epic 1-4에서 백엔드 인프라(DB, 동기화, 세션, 프로토콜)를 구축했다.
이제 사용자가 에이전트와 상호작용할 수 있는 기본 웹 UI를 구현해야 한다.

## Problem Statement

1. **사용자 질문 UI 부재**: 에이전트 질문을 표시하고 응답할 수 있는 UI가 없음
2. **에이전트 협업 시각화 부재**: 에이전트 호출 시 시각적 피드백이 없음
3. **실시간 업데이트 부재**: DB 변경 사항이 실시간으로 UI에 반영되지 않음

## Goals & Non-goals

### Goals
- **Primary**: 사용자 질문 패널 구현 (`UserQuestionPanel`)
- **Secondary**: 에이전트 호출 애니메이션 구현 (`useAgentInvocation`)

### Non-goals
- 워크플로우 진행 상황 표시 (Epic 7에서 구현)
- 에이전트/스킬 정의 편집 UI (Epic 7에서 구현)

## User Stories

### US1: 사용자가 에이전트 질문에 응답한다
**As a** Office 사용자
**I want to** 에이전트의 질문을 확인하고 응답
**So that** 에이전트 작업이 지연 없이 진행된다

### US2: 사용자가 에이전트 협업을 시각적으로 확인한다
**As a** Office 사용자
**I want to** 에이전트가 다른 에이전트를 호출할 때 시각적 피드백
**So that** 현재 진행 상황을 직관적으로 파악할 수 있다

## Technical Constraints

### 기술 스택
- React 18+
- Supabase Realtime (postgres_changes)
- Framer Motion (애니메이션)
- TypeScript

### 실시간 요구사항
- Realtime 이벤트 수신 후 UI 업데이트 < 500ms
- 네트워크 끊김 시 자동 재연결

## Acceptance Criteria

- [ ] `useUserQuestions` 훅 구현 (Realtime 구독)
- [ ] `UserQuestionPanel` 컴포넌트 구현
- [ ] 대기 중인 질문 목록 표시
- [ ] 질문 상세 모달 (텍스트/선택/확인 타입별)
- [ ] 응답 입력 및 DB 업데이트
- [ ] `useAgentInvocation` 훅 구현
- [ ] 에이전트 호출 시 이동 애니메이션
- [ ] 호출 완료 시 원래 위치로 복귀 애니메이션
