# Multi-Agent Orchestration - Advanced Features Specification

## Background

Epic 1-5에서 기본 인프라와 UI를 구축했다.
이제 실제 멀티 에이전트 환경에서 필요한 동시성 처리와 워크플로우 실행 엔진을 구현해야 한다.

## Problem Statement

1. **동시 호출 처리 부재**: 여러 에이전트가 동시에 같은 에이전트를 호출할 때 처리 전략이 없음
2. **역할별 차별화 부재**: 모든 에이전트가 동일한 방식으로 작업을 처리함
3. **워크플로우 자동화 부재**: 사용자 명령을 워크플로우 단계로 분류하고 자동 실행할 수 없음
4. **단계 완료 감지 부재**: `[STEP_COMPLETE]` 메시지를 처리하여 다음 단계를 트리거할 수 없음

## Goals & Non-goals

### Goals
- **Primary**: 역할별 동시성 전략 구현 (`AgentAvailabilityManager`)
- **Secondary**: 워크플로우 실행 엔진 구현 (`WorkflowExecutor`)

### Non-goals
- 복잡한 워크플로우 분기/병합 로직 (향후 확장)
- 에이전트 자동 스케일링 (향후 확장)

## User Stories

### US1: 시스템이 역할별로 다른 동시성 전략을 적용한다
**As a** Office 시스템
**I want to** 에이전트 역할에 따라 다른 동시성 전략 적용
**So that** PO는 순차 처리, FE/BE는 병렬 처리 가능

### US2: 워크플로우가 자동으로 진행된다
**As a** Office 사용자
**I want to** 명령 입력 시 적절한 워크플로우가 자동 실행
**So that** 수동으로 각 단계를 지시하지 않아도 됨

### US3: 단계 완료 시 다음 단계가 자동 트리거된다
**As a** 워크플로우 시스템
**I want to** `[STEP_COMPLETE]` 감지 시 다음 단계 자동 시작
**So that** 워크플로우가 끊김 없이 진행됨

## Technical Constraints

### 역할별 동시성 전략
| 역할 | 전략 | 설명 |
|------|------|------|
| PO | Queue (최대 3) | 순차적 의사결정 필요 |
| PM | Queue (최대 5) | 조율 작업 누적 가능 |
| Designer | Wait (60초) | 디자인 일관성 |
| Architect | Wait (60초) | 아키텍처 일관성 |
| FE/BE | Parallel (2) | 독립 작업 가능 |
| QA | Parallel (2) | 테스트 병렬 실행 |

### 워크플로우 요구사항
- 키워드 기반 워크플로우 분류
- LLM fallback (키워드 매칭 실패 시)
- 단계별 에이전트 자동 할당

## Acceptance Criteria

- [ ] `AgentAvailabilityManager` 클래스 구현
- [ ] 역할별 전략 정의 (Wait, Queue, Parallel, Reject)
- [ ] `canAcceptTask(agentId)` - 작업 수락 가능 여부 확인
- [ ] `enqueueTask(agentId, task)` - 대기열 추가
- [ ] `WorkflowExecutor` 클래스 구현
- [ ] `createInstance(userCommand)` - 워크플로우 인스턴스 생성
- [ ] `executeStep(instanceId, stepId)` - 단계 실행
- [ ] `completeStep(instanceId, stepId, result)` - 단계 완료 처리
- [ ] `[STEP_COMPLETE]` 프로토콜 메시지 파서 추가
