# 04-Session Execution: 구현 계획

> Agent별 Claude Code 세션 생성, 제어, 모니터링

---

## 요구사항 요약

- node-pty 기반 터미널 세션 관리
- Persona 프롬프트 주입 (.claude/CLAUDE.md)
- 작업 완료 감지 (OutputMonitor)
- 세션 풀 관리 (Warm/Cold Pool)
- Supabase Realtime을 통한 명령 전송
- semo-remote-client (Electron) 연동

---

## 영향 범위 분석

| 영역 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/office-server/src/api/sessions/` | 신규 | 세션 관리 API |
| `packages/office-server/src/services/session/` | 신규 | SessionManager, PersonaInjector, OutputMonitor |
| `packages/office-server/src/db/migrations/` | 수정 | agent_commands, agent_command_results 테이블 |
| `packages/semo-remote-client/src/main/` | 신규 | OfficeSubscriber, SessionManager (node-pty) |
| `packages/semo-remote-client/src/main/sessionManager.ts` | 신규 | node-pty 세션 관리 |

---

## 구현 단계

### Phase 1: DB 스키마 및 Realtime 채널 설정

**작업 내용**:
1. `agent_commands`, `agent_command_results` 테이블 생성
2. Supabase Realtime 채널 설정
   - `office:{officeId}:commands` 채널 (Server → Client)
3. Realtime 구독 테스트

**예상 시간**: 1일

**체크리스트**:
- [ ] `agent_commands` 테이블 마이그레이션
- [ ] `agent_command_results` 테이블 마이그레이션
- [ ] Supabase Realtime 활성화 설정
- [ ] 채널 구독 테스트 (Office Server ↔ Client)

---

### Phase 2: semo-remote-client (Electron) 기본 구조

**작업 내용**:
1. Electron 앱 생성
2. node-pty 패키지 설치 및 설정
3. Supabase Client 설정
4. Office 선택 UI (임시)

**예상 시간**: 2일

**체크리스트**:
- [ ] `packages/semo-remote-client` 초기화 (Electron + TypeScript)
- [ ] `node-pty` 설치 및 네이티브 빌드 테스트
- [ ] Supabase Client 초기화 (`.env` 설정)
- [ ] 간단한 Office 선택 UI (Electron 메인 윈도우)
- [ ] 개발 모드 실행 확인

---

### Phase 3: node-pty 기반 SessionManager (Client-side)

**작업 내용**:
1. `SessionManager` 클래스 작성 (Client-side)
   - `create(workingDir)`: 터미널 세션 생성
   - `execute(sessionId, command)`: 명령 전송
   - `sendKeystrokes(sessionId, keys)`: 키 입력 (Ctrl+C 등)
   - `getOutput(sessionId)`: 출력 버퍼 조회
   - `terminate(sessionId)`: 세션 종료
2. 출력 스트림 버퍼링 및 이벤트 전달

**예상 시간**: 2일

**체크리스트**:
- [ ] `SessionManager` 클래스 작성
- [ ] `node-pty` 세션 생성 (spawn)
- [ ] 명령 실행 (`pty.write()`)
- [ ] 출력 버퍼링 (`pty.onData()`)
- [ ] 세션 종료 (`pty.kill()`)
- [ ] 단위 테스트 (Mock PTY)

---

### Phase 4: OfficeSubscriber (Client-side)

**작업 내용**:
1. `OfficeSubscriber` 작성
   - Supabase Realtime 구독
   - `agent_commands` INSERT 감지
   - 명령 타입별 처리 (create_session, send_prompt, terminate 등)
2. 결과를 `agent_command_results`에 INSERT

**예상 시간**: 2일

**체크리스트**:
- [ ] `OfficeSubscriber` 클래스
- [ ] `subscribe(officeId)` 메서드 (Realtime 구독)
- [ ] `handleCommand(payload)` 메서드 (명령 타입별 분기)
- [ ] `createSession()` 핸들러 (SessionManager 호출)
- [ ] `sendPrompt()` 핸들러
- [ ] `terminate()` 핸들러
- [ ] 결과 저장 (`agent_command_results` INSERT)

---

### Phase 5: Persona 주입 (PersonaInjector)

**작업 내용**:
1. `PersonaInjector` 작성 (Server-side)
   - Worktree의 `.claude/CLAUDE.md` 파일 수정
   - Persona 정보 기반 프롬프트 생성
   - `scope_patterns`, `core_skills` 추가
2. Worktree 생성 시 자동 호출

**예상 시간**: 1일

**체크리스트**:
- [ ] `PersonaInjector` 클래스
- [ ] `injectPersona(worktreePath, persona)` 메서드
- [ ] CLAUDE.md 파일 생성/수정 (fs-extra)
- [ ] Persona 프롬프트 템플릿 작성
- [ ] Worktree 생성 흐름에 통합

---

### Phase 6: 작업 완료 감지 (OutputMonitor)

**작업 내용**:
1. `OutputMonitor` 작성 (Server-side)
   - 출력 스트림에서 완료 패턴 감지
   - `[SEMO:DONE]`, PR 생성, 커밋 완료 등
   - Job 상태 업데이트 (`done`)
   - Job Scheduler에 완료 알림
2. 에러 패턴 감지 (실패 처리)

**예상 시간**: 2일

**체크리스트**:
- [ ] `OutputMonitor` 클래스
- [ ] 완료 패턴 정의 (`COMPLETION_PATTERNS`)
- [ ] 에러 패턴 정의 (`ERROR_PATTERNS`)
- [ ] `monitorOutput(sessionId, jobId)` 메서드
- [ ] `handleCompletion(match)` - Job 상태 업데이트
- [ ] `handleError(match)` - Job 실패 처리
- [ ] Job Scheduler 연동 (`onJobComplete()` 호출)

---

### Phase 7: 세션 풀 관리 (SessionPoolManager)

**작업 내용**:
1. `SessionPoolManager` 작성 (Server-side)
   - Warm Pool: Office당 기본 3개 세션 (FE, BE, QA)
   - Cold Pool: 동적 생성
   - 유휴 세션 자동 정리 (10분)

**예상 시간**: 2일

**체크리스트**:
- [ ] `SessionPoolManager` 클래스
- [ ] `acquireSession(officeId, role)` - 가용 세션 조회/생성
- [ ] `releaseSession(sessionId)` - 세션 반환 (Pool에 재사용)
- [ ] `cleanupIdleSessions()` - 유휴 세션 정리
- [ ] Warm Pool 초기화 (Office 생성 시)
- [ ] 최대 동시 세션 수 제한 (Office당 6개)

---

### Phase 8: API 엔드포인트

**작업 내용**:
1. 세션 관리 API
   - `POST /api/offices/:id/sessions` (세션 생성 요청)
   - `GET /api/offices/:id/sessions` (세션 목록)
   - `GET /api/offices/:id/sessions/:sessionId` (세션 상태)
   - `DELETE /api/offices/:id/sessions/:sessionId` (세션 종료)
2. 명령 전송 API
   - `POST /api/offices/:id/sessions/:sessionId/prompt` (프롬프트 전송)
   - `POST /api/offices/:id/sessions/:sessionId/cancel` (Ctrl+C)
   - `GET /api/offices/:id/sessions/:sessionId/output` (출력 조회)

**예상 시간**: 2일

**체크리스트**:
- [ ] 세션 CRUD API (4개 엔드포인트)
- [ ] 명령 API (3개 엔드포인트)
- [ ] 각 API는 `agent_commands` INSERT → Realtime 전파
- [ ] 응답은 `agent_command_results` 대기
- [ ] 타임아웃 처리 (30초)

---

### Phase 9: 통합 테스트

**작업 내용**:
1. E2E 시나리오
   - 세션 생성 → 프롬프트 전송 → 출력 조회 → 완료 감지 → 세션 종료
2. semo-remote-client 통합 테스트
3. 에러 케이스 (타임아웃, 세션 오류)

**예상 시간**: 2일

**체크리스트**:
- [ ] `e2e/session-execution.spec.ts`
- [ ] 실제 Claude Code CLI 세션 테스트
- [ ] 작업 완료 감지 테스트
- [ ] 에러 패턴 감지 테스트
- [ ] semo-remote-client + Office Server 통합 테스트

---

## 의존성

### 외부 라이브러리
- `node-pty`: 터미널 세션 (Client-side)
- `electron`: semo-remote-client
- `@supabase/supabase-js`: Realtime

### 내부 모듈
- **01-Core**: Agent, Office 조회
- **03-Worktree**: Worktree 경로 조회
- **08-Job Scheduler**: Job 완료 알림

---

## 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| node-pty 빌드 오류 (네이티브 모듈) | 높음 | electron-rebuild 사용, 빌드 가이드 문서 |
| 세션 안정성 (크래시, 프리즈) | 높음 | Circuit Breaker, 자동 재시작 |
| 출력 파싱 실패 (완료 감지 오류) | 중간 | 다양한 패턴 테스트, 명시적 마커 사용 |
| Realtime 지연 | 중간 | 타임아웃 설정, 폴링 폴백 |

---

## 예상 결과물

- [ ] `SessionManager` (node-pty 기반, Client-side)
- [ ] `OfficeSubscriber` (Realtime 구독, Client-side)
- [ ] `PersonaInjector` (Server-side)
- [ ] `OutputMonitor` (Server-side)
- [ ] `SessionPoolManager` (Server-side)
- [ ] 세션 API (7개 엔드포인트)
- [ ] DB 마이그레이션 (agent_commands, agent_command_results)
- [ ] semo-remote-client Electron 앱
- [ ] 통합 테스트 스위트

---

## 다음 단계

✅ 04-Session Execution 완료 후:
- **08-Job Scheduler** 구현 (세션 실행 오케스트레이션)
- **05-PR Workflow** 구현 (작업 완료 후 PR 생성)
