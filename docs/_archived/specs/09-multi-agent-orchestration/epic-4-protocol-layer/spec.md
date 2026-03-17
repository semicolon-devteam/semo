# Multi-Agent Orchestration - Protocol Layer Specification

## Background

Epic 1-3에서 DB 스키마, 동기화 서비스, 세션 관리를 구축했다.
이제 Claude Code 세션 출력에서 프로토콜 메시지를 파싱하고 처리하는 핸들러를 구현해야 한다.

## Problem Statement

1. **사용자 질문 처리 불가**: 에이전트가 출력하는 `[ASK_USER]` 메시지를 파싱하여 DB에 저장할 수 없음
2. **에이전트 간 호출 불가**: `[INVOKE:AgentName]` 메시지를 감지하여 다른 에이전트를 호출할 수 없음
3. **결과물 전달 불가**: `[DELIVER_RESULT:AgentName]` 메시지로 에이전트 간 결과물 전달 불가
4. **사용자 응답 전달 불가**: 사용자가 응답한 내용을 에이전트 세션에 전달할 수 없음

## Goals & Non-goals

### Goals
- **Primary**: 에이전트 → 사용자 질문 처리 (`[ASK_USER]` 프로토콜)
- **Secondary**: 에이전트 간 호출 처리 (`[INVOKE:AgentName]` 프로토콜)
- **Tertiary**: 결과물 전달 처리 (`[DELIVER_RESULT:AgentName]` 프로토콜)

### Non-goals
- 동시성 처리 (Epic 6에서 구현)
- 워크플로우 단계 실행 (Epic 6에서 구현)

## User Stories

### US1: 에이전트가 사용자에게 질문한다
**As a** Office 에이전트
**I want to** `[ASK_USER]` 메시지로 사용자에게 질문을 전송
**So that** 필요한 정보를 사용자로부터 받을 수 있다

### US2: 사용자 응답이 에이전트에게 전달된다
**As a** 웹 UI 사용자
**I want to** 질문에 응답하면 에이전트가 바로 응답을 받길
**So that** 대화가 지연 없이 진행된다

### US3: 에이전트가 다른 에이전트를 호출한다
**As an** Orchestrator 에이전트
**I want to** `[INVOKE:PO]` 메시지로 다른 에이전트를 호출
**So that** 작업을 위임할 수 있다

### US4: 에이전트가 결과물을 전달한다
**As a** Planner 에이전트
**I want to** `[DELIVER_RESULT:PO]` 메시지로 작업 결과를 전달
**So that** PO가 결과물을 확인하고 다음 작업을 진행할 수 있다

## Technical Constraints

### 프로토콜 메시지 형식
```markdown
### [ASK_USER]
질문: {질문 내용}
타입: text | selection | confirmation
옵션: [{선택지1}, {선택지2}]  # selection 타입만

### [INVOKE:AgentName]
{작업 요청 내용}
컨텍스트: {관련 정보}

### [DELIVER_RESULT:AgentName]
타입: github_issue | markdown | json | file_path
내용: {결과물 내용 또는 참조}
```

### 파서 요구사항
- PTY 출력 스트림에서 프로토콜 패턴 감지
- ANSI 이스케이프 코드 제거 후 파싱
- 멀티라인 메시지 처리

## Acceptance Criteria

- [ ] `[ASK_USER]` 프로토콜 메시지 파서 구현
- [ ] `user_questions` 테이블에 질문 INSERT
- [ ] 사용자 응답 시 해당 세션에 응답 전달
- [ ] `[INVOKE:AgentName]` 프로토콜 메시지 파서 구현
- [ ] `agent_invocations` 테이블에 호출 기록 INSERT
- [ ] 호출된 에이전트 세션 생성 또는 기존 세션에 작업 전달
- [ ] `[DELIVER_RESULT:AgentName]` 프로토콜 메시지 파서 구현
- [ ] `agent_results` 테이블에 결과물 INSERT
- [ ] 수신 에이전트에 결과 통지
