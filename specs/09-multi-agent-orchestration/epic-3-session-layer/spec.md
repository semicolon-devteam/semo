# Multi-Agent Orchestration - Session Layer Specification

## Background

Epic 1-2에서 DB 스키마와 동기화 서비스를 구축했다.
이제 실제 Claude Code 세션을 생성하고 관리하는 `AgentSessionManager`를 구현해야 한다.

## Problem Statement

1. **세션 생명주기 관리 부재**: Claude Code 세션 생성/종료를 관리하는 중앙 컴포넌트가 없음
2. **프롬프트 전송 불가**: 외부에서 Claude Code 세션에 프롬프트를 전송할 방법이 없음
3. **출력 모니터링 불가**: Claude Code 출력을 캡처하고 작업 완료를 감지할 수 없음
4. **실시간 명령 전달 불가**: DB 변경 시 세션에 자동으로 명령을 전달할 수 없음

## Goals & Non-goals

### Goals
- **Primary**: Claude Code 세션 생성/종료 관리 (`AgentSessionManager`)
- **Secondary**: 프롬프트 전송 및 출력 모니터링
- **Tertiary**: Supabase Realtime 구독을 통한 명령 자동 전달

### Non-goals
- 프로토콜 메시지 파싱 (Epic 4에서 구현)
- 동시성 처리 (Epic 6에서 구현)

## User Stories

### US1: 서버가 에이전트 세션을 생성한다
**As a** Office Server
**I want to** 특정 에이전트의 Claude Code 세션을 생성
**So that** 에이전트가 작업을 수행할 수 있다

### US2: 서버가 세션에 프롬프트를 전송한다
**As a** Office Server
**I want to** 세션에 프롬프트를 전송하고 응답을 대기
**So that** 에이전트에게 작업을 지시할 수 있다

### US3: DB 명령이 세션에 자동 전달된다
**As a** 웹 UI 사용자
**I want to** DB에 명령 INSERT 시 자동으로 세션에 전달되길
**So that** 실시간으로 에이전트와 상호작용할 수 있다

## Technical Constraints

### node-pty 요구사항
- `node-pty` 패키지 사용 (터미널 에뮬레이션)
- `zsh` 또는 `bash` 쉘 사용
- PTY 출력 버퍼링 필요

### Worktree 관리
- Git worktree 또는 임시 디렉토리 사용
- 세션 종료 시 정리 (옵션)

## Acceptance Criteria

- [ ] `AgentSessionManager` 클래스 구현
- [ ] `createSession(agentId, officeId)` - 세션 생성
- [ ] `destroySession(sessionId)` - 세션 종료
- [ ] `sendPrompt(sessionId, prompt)` - 프롬프트 전송
- [ ] `sendPromptAndWait(sessionId, prompt)` - 프롬프트 전송 및 응답 대기
- [ ] PTY 출력 버퍼링 및 이벤트 발생
- [ ] 작업 완료 감지 (프롬프트 대기 상태 인식)
- [ ] `startListening(officeId)` - Supabase Realtime 구독
- [ ] `agent_commands` INSERT 이벤트 처리
- [ ] `user_questions` UPDATE 이벤트 처리 (응답 수신)
- [ ] DB에 세션 상태 동기화 (`agent_sessions` 테이블)
