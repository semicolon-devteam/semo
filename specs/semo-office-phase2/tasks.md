# Semo Office Phase 2 - Tasks

> DDD Layer 기반 작업 분해

---

## Task Summary

| Layer | 작업 수 | 버전 범위 |
|-------|---------|-----------|
| CONFIG | 3 | v0.1.x |
| DATA | 2 | v0.2.x |
| INFRA | 4 | v0.3.x |
| APPLICATION | 6 | v0.4.x |
| TESTS | 3 | v0.5.x |
| **Total** | **18** | |

---

## Layer 0: CONFIG (v0.1.x)

### TASK-001: DB 마이그레이션 파일 생성

**파일**: `semo-system/semo-remote/db/migrations/005_office_commands.sql`

**작업 내용**:
- [ ] agent_commands 테이블 생성
- [ ] agent_command_results 테이블 생성
- [ ] agent_sessions 테이블 생성
- [ ] Realtime publication 추가
- [ ] 인덱스 생성

**Acceptance Criteria**:
- Supabase SQL Editor에서 실행 가능
- 기존 테이블(offices, worktrees 등)과 FK 연결

---

### TASK-002: 환경변수 설정

**파일**: `semo-remote-client/.env.example`

**작업 내용**:
- [ ] SEMO_OFFICE_MODE 추가
- [ ] SEMO_OFFICE_ID 추가
- [ ] README에 환경변수 설명 추가

**Acceptance Criteria**:
- `.env.example`에 Office Mode 설정 문서화
- 기본값: SEMO_OFFICE_MODE=false

---

### TASK-003: Supabase Realtime 설정

**작업 내용**:
- [ ] agent_commands 테이블 Realtime 활성화
- [ ] agent_command_results 테이블 Realtime 활성화
- [ ] RLS 정책 설정 (office_id 기반 필터링)

**Acceptance Criteria**:
- Supabase Dashboard에서 Realtime 활성화 확인
- INSERT 이벤트 수신 테스트 통과

---

## Layer 1: DATA (v0.2.x)

### TASK-004: TypeScript 인터페이스 정의

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
interface AgentCommand {
  id: string;
  office_id: string;
  agent_id: string | null;
  job_id: string | null;
  iterm_session_id: string | null;
  command_type: string;
  payload: Record<string, unknown>;
  status: string;
  timeout_seconds: number;
  created_at: string;
}

interface CommandResult {
  success: boolean;
  output?: string;
  prNumber?: number;
  sessionId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface ItermSession {
  id: string;
  name: string;
  cwd: string;
  isActive: boolean;
  pid: number | null;
  isClaudeCode: boolean;
  processName: string | null;
}

interface OfficeDependencies {
  supabase: SupabaseClient;
  sendToClaudeCode: SendToClaudeCodeFn;
  createNewItermTab: CreateNewItermTabFn;
  sendToIterm: SendToItermFn;
  getSessionOutput: GetSessionOutputFn;
}
```

**Acceptance Criteria**:
- TypeScript 컴파일 오류 없음
- 기존 타입과 호환

---

### TASK-005: Command Type Enum 정의

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
type CommandType =
  | 'create_session'
  | 'send_prompt'
  | 'send_text'
  | 'get_output'
  | 'cancel'
  | 'terminate';
```

**Acceptance Criteria**:
- 6가지 명령 타입 정의
- office-server의 SessionExecutor와 타입 일치

---

## Layer 2: INFRA (v0.3.x)

### TASK-006: Realtime 구독 구현

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
export async function subscribeToOfficeCommands(officeId: string): Promise<void> {
  officeChannel = deps.supabase
    .channel(`office_commands:${officeId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'agent_commands',
      filter: `office_id=eq.${officeId}`,
    }, async (payload) => {
      const command = payload.new as AgentCommand;
      if (command.status === 'pending' && !processingCommands.has(command.id)) {
        processingCommands.add(command.id);
        await handleCommand(command);
        processingCommands.delete(command.id);
      }
    })
    .subscribe();
}
```

**Acceptance Criteria**:
- agent_commands INSERT 시 콜백 실행
- office_id 필터링 동작
- 중복 처리 방지

---

### TASK-007: 폴링 Fallback 구현

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
function startPolling(officeId: string): void {
  pollingInterval = setInterval(async () => {
    await pollPendingCommands(officeId);
  }, 2000);
}

async function pollPendingCommands(officeId: string): Promise<void> {
  const { data: commands } = await deps.supabase
    .from('agent_commands')
    .select('*')
    .eq('office_id', officeId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  for (const command of commands) {
    if (!processingCommands.has(command.id)) {
      processingCommands.add(command.id);
      handleCommand(command);
    }
  }
}
```

**Acceptance Criteria**:
- 2초 간격 폴링
- Realtime 실패 시 자동 활성화
- pending 상태 명령만 조회

---

### TASK-008: 구독 해제 구현

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
export async function unsubscribeFromOfficeCommands(): Promise<void> {
  if (officeChannel && deps) {
    await deps.supabase.removeChannel(officeChannel);
    officeChannel = null;
  }
  activeOfficeId = null;
  stopPolling();
}
```

**Acceptance Criteria**:
- Realtime 채널 정리
- 폴링 중지
- 상태 초기화

---

### TASK-009: 결과 저장 함수

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
async function saveCommandResult(commandId: string, result: CommandResult): Promise<void> {
  await deps.supabase.from('agent_command_results').insert({
    command_id: commandId,
    success: result.success,
    output: result.output,
    pr_number: result.prNumber,
    metadata: {
      session_id: result.sessionId,
      ...result.metadata,
    },
  });
}
```

**Acceptance Criteria**:
- agent_command_results INSERT 성공
- metadata에 session_id 포함

---

## Layer 3: APPLICATION (v0.4.x)

### TASK-010: handleCreateSession 핸들러

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
async function handleCreateSession(command: AgentCommand): Promise<CommandResult> {
  const { worktree_path, persona_name, initial_prompt } = command.payload;

  // 1. 새 iTerm 탭 생성 + Claude Code 실행
  const result = await deps.createNewItermTab(worktree_path, true);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // 2. agent_sessions에 등록
  await deps.supabase.from('agent_sessions').insert({
    office_id: command.office_id,
    agent_id: command.agent_id,
    iterm_session_id: result.session.id,
    iterm_tab_name: `Agent: ${persona_name}`,
    is_claude_code: true,
    status: 'active',
    cwd: worktree_path,
  });

  // 3. Claude Code 초기화 대기
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 4. 초기 프롬프트 전송
  const sendResult = await deps.sendToClaudeCode(result.session.id, initial_prompt, 'applescript');

  return {
    success: sendResult,
    sessionId: result.session.id,
  };
}
```

**Acceptance Criteria**:
- iTerm 탭 생성
- Claude Code 실행
- 초기 프롬프트 전송
- agent_sessions 등록

---

### TASK-011: handleSendPrompt 핸들러

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
async function handleSendPrompt(command: AgentCommand): Promise<CommandResult> {
  const { prompt, method } = command.payload;

  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  const result = await deps.sendToClaudeCode(
    command.iterm_session_id,
    prompt,
    method || 'applescript'
  );

  return { success: result, output: result ? 'Prompt sent' : 'Failed' };
}
```

**Acceptance Criteria**:
- iterm_session_id 검증
- AppleScript로 프롬프트 전송
- 결과 반환

---

### TASK-012: handleSendText, handleGetOutput 핸들러

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
async function handleSendText(command: AgentCommand): Promise<CommandResult> {
  const { text } = command.payload;
  const result = await deps.sendToIterm(command.iterm_session_id, text, false);
  return { success: result };
}

async function handleGetOutput(command: AgentCommand): Promise<CommandResult> {
  const { lines } = command.payload;
  const result = await deps.getSessionOutput(command.iterm_session_id, lines || 100);
  return { success: result.success, output: result.lines?.join('\n') };
}
```

**Acceptance Criteria**:
- send_text: 일반 텍스트 전송
- get_output: 세션 출력 조회

---

### TASK-013: handleCancel, handleTerminate 핸들러

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
```typescript
async function handleCancel(command: AgentCommand): Promise<CommandResult> {
  const result = await deps.sendToIterm(command.iterm_session_id, '\x03', false);
  return { success: result };
}

async function handleTerminate(command: AgentCommand): Promise<CommandResult> {
  await deps.supabase
    .from('agent_sessions')
    .update({ status: 'disconnected' })
    .eq('iterm_session_id', command.iterm_session_id);

  const result = await deps.sendToIterm(command.iterm_session_id, 'exit\n', false);
  return { success: result };
}
```

**Acceptance Criteria**:
- cancel: Ctrl+C 전송
- terminate: 세션 상태 업데이트 + exit 전송

---

### TASK-014: main/index.ts 통합

**파일**: `semo-remote-client/src/main/index.ts`

**작업 내용**:
- [ ] officeSubscriber import 추가
- [ ] OFFICE_MODE, OFFICE_ID 환경변수 추가
- [ ] getSessionOutput 함수 추가
- [ ] initializeSupabase()에 Office 초기화 로직 추가
- [ ] before-quit에 구독 정리 추가

**Acceptance Criteria**:
- Office Mode 환경변수 동작
- 앱 시작 시 자동 구독
- 앱 종료 시 정리

---

### TASK-015: IPC 핸들러 추가

**파일**: `semo-remote-client/src/main/index.ts`

**작업 내용**:
```typescript
ipcMain.handle('office:get-status', () => ({
  enabled: OFFICE_MODE,
  officeId: getActiveOfficeId(),
  isActive: isOfficeModeActive(),
}));

ipcMain.handle('office:subscribe', async (_, officeId: string) => {
  initializeOfficeSubscriber({...});
  await subscribeToOfficeCommands(officeId);
  return { success: true, officeId };
});

ipcMain.handle('office:unsubscribe', async () => {
  await unsubscribeFromOfficeCommands();
  return { success: true };
});
```

**Acceptance Criteria**:
- Renderer에서 Office 상태 조회 가능
- 동적 구독/해제 가능

---

## Layer 4: TESTS (v0.5.x)

### TASK-016: 단위 테스트

**파일**: `semo-remote-client/src/main/__tests__/officeSubscriber.test.ts`

**작업 내용**:
- [ ] initializeOfficeSubscriber 테스트
- [ ] subscribeToOfficeCommands 테스트 (Supabase 모킹)
- [ ] 각 핸들러 함수 테스트

**Acceptance Criteria**:
- 의존성 모킹으로 격리된 테스트
- 모든 핸들러 커버리지

---

### TASK-017: 통합 테스트

**파일**: `semo-remote-client/e2e/office-integration.spec.ts`

**작업 내용**:
- [ ] Office Server에서 명령 INSERT
- [ ] semo-remote-client 수신 확인
- [ ] iTerm 세션 생성 확인
- [ ] 결과 저장 확인

**Acceptance Criteria**:
- 실제 Supabase 연결 테스트
- End-to-end 흐름 검증

---

### TASK-018: 매뉴얼 테스트 문서

**파일**: `docs/semo-office/TESTING.md`

**작업 내용**:
- [ ] 환경 설정 가이드
- [ ] 수동 테스트 시나리오
- [ ] 문제 해결 가이드

**Acceptance Criteria**:
- 새 개발자가 따라할 수 있는 수준
- 일반적인 오류 상황 대응 포함

---

## Dependencies Graph

```
TASK-001 (DB Schema)
    ↓
TASK-003 (Realtime 설정)
    ↓
TASK-004, TASK-005 (Types)
    ↓
TASK-006, TASK-007, TASK-008, TASK-009 (INFRA)
    ↓
TASK-010 ~ TASK-015 (APPLICATION)
    ↓
TASK-016, TASK-017, TASK-018 (TESTS)

TASK-002 (환경변수)는 독립적으로 진행 가능
```

---

## Completion Checklist

- [ ] CONFIG: DB 스키마 적용 완료
- [ ] CONFIG: 환경변수 설정 완료
- [ ] DATA: 타입 정의 완료
- [ ] INFRA: Realtime 구독 동작
- [ ] INFRA: 폴링 fallback 동작
- [ ] APPLICATION: 6가지 핸들러 구현
- [ ] APPLICATION: main/index.ts 통합
- [ ] TESTS: 통합 테스트 통과
- [ ] DOCS: 매뉴얼 테스트 문서화
