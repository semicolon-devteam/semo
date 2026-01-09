# Multi-Agent Orchestration - Session Layer Tasks

## Task Overview

| ID | Layer | Task | Complexity | Dependencies |
|----|-------|------|------------|--------------|
| T1 | v0.1.x CONFIG | node-pty 패키지 설치 | S | - |
| T2 | v0.2.x PROJECT | agent-client 디렉토리 구조 생성 | S | - |
| T3 | v0.3.x DATA | agent_sessions 테이블 추가 (필요 시) | S | Epic 1 |
| T4 | v0.5.x CODE | AgentSessionManager 기본 구조 | M | T2 |
| T5 | v0.5.x CODE | createSession() 구현 | L | T4, Epic 2 |
| T6 | v0.5.x CODE | destroySession() 구현 | M | T5 |
| T7 | v0.5.x CODE | Worktree 관리 로직 | M | T4 |
| T8 | v0.5.x CODE | PTY 출력 버퍼링 및 파싱 | L | T5 |
| T9 | v0.5.x CODE | sendPrompt() 구현 | M | T5 |
| T10 | v0.5.x CODE | sendPromptAndWait() 구현 | L | T8, T9 |
| T11 | v0.5.x CODE | Supabase Realtime 구독 | M | T4 |
| T12 | v0.5.x CODE | agent_commands 이벤트 처리 | M | T11 |
| T13 | v0.5.x CODE | user_questions 응답 이벤트 처리 | M | T11 |
| T14 | v0.4.x TESTS | AgentSessionManager 단위 테스트 | M | T4-T13 |

## Task Details

### T1: [v0.1.x CONFIG] node-pty 패키지 설치
- **Complexity**: S
- **Dependencies**: -
- **Description**: node-pty 및 관련 패키지 설치
- **Acceptance Criteria**:
  - [ ] `npm install node-pty` 실행
  - [ ] TypeScript 타입 정의 확인

### T2: [v0.2.x PROJECT] agent-client 디렉토리 구조 생성
- **Complexity**: S
- **Dependencies**: -
- **Description**: 세션 관리 관련 파일 구조 생성
- **Acceptance Criteria**:
  - [ ] `packages/office-server/src/agent-client/` 디렉토리
  - [ ] `index.ts`, `types.ts` 파일

### T3: [v0.3.x DATA] agent_sessions 테이블 추가
- **Complexity**: S
- **Dependencies**: Epic 1
- **Description**: 활성 세션 상태를 저장하는 테이블 (Epic 1에서 누락된 경우)
- **Acceptance Criteria**:
  - [ ] `agent_sessions` 테이블 생성
  - [ ] `status`, `cwd`, `pid` 컬럼 포함

```sql
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  office_id UUID REFERENCES offices(id),
  agent_id UUID REFERENCES office_agents(id),
  status TEXT DEFAULT 'active',  -- active, idle, terminated
  cwd TEXT,
  pid INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now()
);
```

### T4: [v0.5.x CODE] AgentSessionManager 기본 구조
- **Complexity**: M
- **Dependencies**: T2
- **Description**: 세션 매니저 클래스 골격 구현
- **Acceptance Criteria**:
  - [ ] EventEmitter 상속
  - [ ] sessions Map 선언
  - [ ] 메서드 시그니처 정의

### T5: [v0.5.x CODE] createSession() 구현
- **Complexity**: L (Large)
- **Dependencies**: T4, Epic 2
- **Description**: 에이전트 세션 생성 전체 흐름 구현
- **Acceptance Criteria**:
  - [ ] Worktree 경로 확보
  - [ ] AgentDefinitionSync.syncToWorktree() 호출
  - [ ] node-pty 터미널 생성
  - [ ] `claude` 명령 실행
  - [ ] 세션 객체 Map에 등록
  - [ ] DB에 세션 상태 등록

```typescript
async createSession(agentId: string, officeId: string): Promise<AgentSession> {
  const worktreePath = await this.getOrCreateWorktree(officeId, agentId);
  await this.definitionSync.syncToWorktree(officeId, worktreePath);

  const pty = spawn('zsh', [], {
    name: 'xterm-color',
    cols: 120,
    rows: 40,
    cwd: worktreePath,
    env: { ...process.env, CLAUDE_AUTO_APPROVE: 'true' },
  });

  // PTY 출력 핸들러 설정
  this.setupOutputHandler(pty, sessionId);

  // Claude Code 시작
  pty.write('claude\r');

  const session: AgentSession = {
    id: `session-${Date.now()}`,
    officeId,
    agentId,
    ptyProcess: pty,
    worktreePath,
    status: 'starting',
    outputBuffer: { content: '', lastUpdate: Date.now() },
  };

  this.sessions.set(session.id, session);
  await this.registerSessionInDb(session);

  return session;
}
```

### T6: [v0.5.x CODE] destroySession() 구현
- **Complexity**: M
- **Dependencies**: T5
- **Description**: 세션 종료 및 리소스 정리
- **Acceptance Criteria**:
  - [ ] PTY 프로세스 종료
  - [ ] sessions Map에서 제거
  - [ ] DB 상태 업데이트
  - [ ] Worktree 정리 (옵션)

### T7: [v0.5.x CODE] Worktree 관리 로직
- **Complexity**: M
- **Dependencies**: T4
- **Description**: Git worktree 또는 임시 디렉토리 관리
- **Acceptance Criteria**:
  - [ ] `getOrCreateWorktree(officeId, agentId)` 구현
  - [ ] 경로: `/tmp/semo-office/{officeId}/{agentId}/`
  - [ ] 기존 worktree 재사용 로직

### T8: [v0.5.x CODE] PTY 출력 버퍼링 및 파싱
- **Complexity**: L
- **Dependencies**: T5
- **Description**: PTY 출력을 버퍼링하고 프롬프트 대기 상태 감지
- **Acceptance Criteria**:
  - [ ] 출력 버퍼 관리
  - [ ] ANSI 이스케이프 코드 처리
  - [ ] 프롬프트 패턴 감지 (`> ` 또는 유사)
  - [ ] 작업 완료 감지

```typescript
private isPromptReady(content: string): boolean {
  // Claude Code 프롬프트 패턴 (예시)
  const promptPatterns = [
    />\s*$/,                     // 기본 프롬프트
    /\(y\/n\)\s*$/,              // 확인 프롬프트
    /Press Enter to continue/,  // 계속 프롬프트
  ];

  return promptPatterns.some(pattern => pattern.test(content));
}
```

### T9: [v0.5.x CODE] sendPrompt() 구현
- **Complexity**: M
- **Dependencies**: T5
- **Description**: 세션에 프롬프트 전송 (비동기)
- **Acceptance Criteria**:
  - [ ] 세션 존재 확인
  - [ ] PTY에 프롬프트 쓰기
  - [ ] 상태 업데이트

### T10: [v0.5.x CODE] sendPromptAndWait() 구현
- **Complexity**: L
- **Dependencies**: T8, T9
- **Description**: 프롬프트 전송 후 응답 완료까지 대기
- **Acceptance Criteria**:
  - [ ] Promise 기반 응답 대기
  - [ ] 타임아웃 처리
  - [ ] 출력 버퍼 반환

```typescript
async sendPromptAndWait(
  sessionId: string,
  prompt: string,
  timeout: number = 60000
): Promise<string> {
  const session = this.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Prompt timeout'));
    }, timeout);

    const handler = (sid: string, output: string) => {
      if (sid === sessionId) {
        clearTimeout(timeoutId);
        this.off('output', handler);
        resolve(output);
      }
    };

    this.on('output', handler);
    session.ptyProcess.write(prompt + '\r');
  });
}
```

### T11: [v0.5.x CODE] Supabase Realtime 구독
- **Complexity**: M
- **Dependencies**: T4
- **Description**: Realtime 채널 구독 및 이벤트 수신
- **Acceptance Criteria**:
  - [ ] `startListening(officeId)` 구현
  - [ ] `stopListening()` 구현
  - [ ] 연결 상태 모니터링

### T12: [v0.5.x CODE] agent_commands 이벤트 처리
- **Complexity**: M
- **Dependencies**: T11
- **Description**: DB INSERT 시 세션에 명령 전달
- **Acceptance Criteria**:
  - [ ] `command_type` 분기 처리
  - [ ] `send_prompt` 명령 처리
  - [ ] 명령 상태 업데이트

### T13: [v0.5.x CODE] user_questions 응답 이벤트 처리
- **Complexity**: M
- **Dependencies**: T11
- **Description**: 사용자 응답 수신 시 세션에 전달
- **Acceptance Criteria**:
  - [ ] `status: 'answered'` 감지
  - [ ] 응답을 해당 세션에 전달

### T14: [v0.4.x TESTS] AgentSessionManager 단위 테스트
- **Complexity**: M
- **Dependencies**: T4-T13
- **Description**: 세션 매니저 테스트
- **Acceptance Criteria**:
  - [ ] Mock PTY 사용
  - [ ] 세션 생성/종료 테스트
  - [ ] 프롬프트 전송 테스트
  - [ ] Realtime 이벤트 테스트

## Test Requirements

### 엔지니어 테스트
```typescript
// 세션 생성 및 프롬프트 테스트
const manager = new AgentSessionManager(supabase);
const session = await manager.createSession('agent-uuid', 'office-uuid');

const output = await manager.sendPromptAndWait(session.id, 'echo "Hello"');
assert(output.includes('Hello'));

await manager.destroySession(session.id);
```

### Realtime 테스트
```typescript
// Realtime 구독 테스트
manager.startListening('office-uuid');

// DB에 명령 INSERT
await supabase.from('agent_commands').insert({
  office_id: 'office-uuid',
  agent_id: 'agent-uuid',
  command_type: 'send_prompt',
  payload: { prompt: 'Hello' }
});

// 세션에 명령 전달 확인 (이벤트 또는 로그)
```
