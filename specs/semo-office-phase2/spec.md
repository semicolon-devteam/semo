# Semo Office Phase 2 - Specification

> Office Server와 semo-remote-client 통합

## Background

### Phase 1 완료 내역

Phase 1 (MVP v0.1.0)에서 다음이 구현되었습니다:

- **DB 스키마**: `004_office_tables.sql` - offices, worktrees, agent_personas, office_agents, job_queue 테이블
- **office-server 패키지**: Task Decomposer, Session Pool, Worktree Manager, Job Scheduler
- **office-web 패키지**: Next.js + PixiJS 기반 가상 오피스 UI
- **semo-office 스킬**: create-worktree, remove-worktree, create-pr, merge-pr, sync-branch

### 현재 상태

Phase 1에서는 Office UI와 백엔드 로직이 구현되었으나, 실제 Claude Code 세션 실행 및 제어가 **시뮬레이션** 상태입니다.

---

## Problem Statement

Office Server가 작업을 분해하고 Job을 생성해도, 실제로 Claude Code 세션을 생성하고 프롬프트를 전송하는 **실행 계층이 없습니다**.

현재 한계:
1. Agent가 작업을 받아도 실제 Claude Code 세션이 생성되지 않음
2. iTerm2에서 Claude Code를 자동으로 실행할 방법이 없음
3. 프롬프트 전송 및 작업 결과 수집이 불가능
4. Agent 상태(working, idle, blocked)가 실제 세션과 동기화되지 않음

---

## Goals

### Primary Goal

Office Server와 semo-remote-client 간 실시간 양방향 통신을 구축하여, Office Server의 명령이 실제 Claude Code 세션으로 실행되도록 합니다.

### Success Metrics

| 메트릭 | 목표 |
|--------|------|
| 명령 전달 지연 | < 2초 (Realtime) |
| 세션 생성 성공률 | > 95% |
| 결과 수집률 | 100% |
| Agent 상태 동기화 | 실시간 |

---

## User Stories

### US-1: Office Server가 Claude Code 세션 생성

**As a** Semo Office Server
**I want to** agent_commands 테이블에 create_session 명령을 INSERT
**So that** semo-remote-client가 이를 수신하여 새 iTerm 탭에서 Claude Code 세션을 생성함

**Acceptance Criteria:**
- [ ] agent_commands에 INSERT 시 semo-remote-client가 Realtime으로 수신
- [ ] worktree_path 경로에서 iTerm 탭 생성
- [ ] Claude Code 자동 실행 (`claude` 명령)
- [ ] 초기 프롬프트(persona_prompt + initial_prompt) 전송
- [ ] agent_sessions에 세션 정보 등록
- [ ] agent_command_results에 결과(success/fail, session_id) 저장

### US-2: 기존 세션에 프롬프트 전송

**As a** Semo Office Server
**I want to** 기존 Claude Code 세션에 새 프롬프트를 전송
**So that** Agent가 연속적인 작업을 수행할 수 있음

**Acceptance Criteria:**
- [ ] send_prompt 명령에 iterm_session_id 포함
- [ ] AppleScript를 통해 Claude Code 입력창에 프롬프트 전송
- [ ] Enter 키 자동 입력으로 실행 트리거
- [ ] 전송 성공/실패 결과 반환

### US-3: 세션 출력 조회

**As a** Semo Office Server
**I want to** Claude Code 세션의 최근 출력을 조회
**So that** 작업 진행 상황을 모니터링할 수 있음

**Acceptance Criteria:**
- [ ] get_output 명령으로 최근 N줄 조회
- [ ] iTerm2 Python API를 통해 세션 내용 추출
- [ ] 출력 내용을 agent_command_results에 저장

### US-4: 작업 취소 및 세션 종료

**As a** Semo Office Server
**I want to** 진행 중인 작업을 취소하거나 세션을 종료
**So that** 비정상 상황에서 리소스를 정리할 수 있음

**Acceptance Criteria:**
- [ ] cancel 명령: Ctrl+C 전송 (진행 중인 작업 중단)
- [ ] terminate 명령: exit 전송 후 세션 상태 disconnected로 변경
- [ ] agent_sessions 테이블 상태 업데이트

### US-5: Office Mode 환경 설정

**As a** semo-remote-client 사용자
**I want to** 환경변수로 Office Mode를 활성화
**So that** 특정 Office의 명령을 수신할 수 있음

**Acceptance Criteria:**
- [ ] SEMO_OFFICE_MODE=true로 Office Mode 활성화
- [ ] SEMO_OFFICE_ID로 구독할 Office 지정
- [ ] 앱 시작 시 자동으로 Realtime 구독 시작
- [ ] 앱 종료 시 구독 정리

---

## Technical Requirements

### TR-1: Supabase Realtime 구독

```typescript
// semo-remote-client에서 구독
supabase
  .channel(`office_commands:${officeId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'agent_commands',
    filter: `office_id=eq.${officeId}`,
  }, handleCommand)
  .subscribe();
```

### TR-2: 명령 타입별 핸들러

| command_type | 핸들러 | 설명 |
|--------------|--------|------|
| `create_session` | handleCreateSession | 새 세션 생성 + 초기 프롬프트 |
| `send_prompt` | handleSendPrompt | 기존 세션에 프롬프트 전송 |
| `send_text` | handleSendText | 일반 텍스트 전송 |
| `get_output` | handleGetOutput | 세션 출력 조회 |
| `cancel` | handleCancel | Ctrl+C 전송 |
| `terminate` | handleTerminate | 세션 종료 |

### TR-3: 폴링 백업 (Fallback)

Realtime 연결 실패 시 2초 간격 폴링으로 pending 명령 조회

### TR-4: 중복 처리 방지

processingCommands Set으로 동일 명령 중복 처리 방지

---

## Non-Functional Requirements

### NFR-1: 성능

- 명령 수신 → 처리 시작: < 500ms
- 세션 생성 완료: < 10초 (Claude Code 초기화 포함)
- 프롬프트 전송: < 1초

### NFR-2: 안정성

- Realtime 끊김 시 자동 재연결
- 폴링 fallback으로 명령 누락 방지
- 앱 종료 시 graceful shutdown

### NFR-3: 관측 가능성

- 모든 명령 처리 로깅 (`[Office]` 프리픽스)
- agent_command_results에 상세 결과 저장
- 에러 발생 시 error_message 기록

---

## Out of Scope (Phase 3)

- 완료 감지 로직 (Claude Code idle 상태, PR 생성 감지)
- 에러 복구 자동화
- 멀티 Office 동시 구독
- UI에서 Office 선택 기능

---

## Dependencies

### 내부 의존성

| 의존성 | 설명 |
|--------|------|
| semo-remote-client | Electron 앱, iTerm2 Python API 연동 |
| office-server | SessionExecutor가 명령 INSERT |
| Supabase | agent_commands, agent_command_results 테이블 |

### 외부 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| @supabase/supabase-js | ^2.x | Realtime 구독 |
| iTerm2 Python API | - | 세션 제어 |

---

## Risks

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|-----------|
| Realtime 연결 불안정 | 중 | 높음 | 폴링 fallback 구현 |
| Claude Code 초기화 지연 | 높음 | 중 | 5초 대기 후 프롬프트 전송 |
| iTerm2 API 호환성 | 낮음 | 높음 | 기존 semo-remote-client 로직 재사용 |

---

## Glossary

| 용어 | 정의 |
|------|------|
| Office | GitHub Org + Repo를 매핑한 가상 오피스 단위 |
| Agent | 특정 역할(FE, BE, QA 등)을 수행하는 AI 에이전트 |
| Worktree | Agent별 독립된 Git worktree 디렉토리 |
| Session | iTerm2에서 실행 중인 Claude Code 인스턴스 |
| Command | Office Server가 semo-remote-client에 전달하는 명령 |
