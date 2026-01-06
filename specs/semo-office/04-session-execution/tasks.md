# 04-Session Execution: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| CONFIG | 1 | v0.1.0 |
| DATA | 1 | v0.1.1 |
| INFRA | 2 | v0.1.2 |
| APPLICATION | 4 | v0.1.3 |
| PRESENTATION | 2 | v0.1.4 |
| **Total** | **10** | |

---

## Layer 0: CONFIG

### TASK-SE01: 세션 명령 테이블 스키마

**파일**: `005_office_commands.sql`

**작업 내용**:
- [ ] agent_commands 테이블 생성
- [ ] agent_command_results 테이블 생성
- [ ] 인덱스 생성 (office_id, status, command_id)
- [ ] Realtime 활성화

---

## Layer 1: DATA

### TASK-SE02: 세션 관련 TypeScript 타입

**파일**: `packages/office-server/src/types/session.ts`

**작업 내용**:
```typescript
// SessionInfo
interface SessionInfo {
  session_id: string;
  agent_id: string;
  worktree_id: string;
  iterm_tab_id: string;
  status: SessionStatus;
  created_at: string;
  last_activity_at: string;
}

type SessionStatus =
  | 'creating' | 'ready' | 'executing'
  | 'waiting_input' | 'error' | 'terminated';

// AgentCommand
interface AgentCommand {
  id: string;
  office_id: string;
  session_id?: string;
  command_type: CommandType;
  payload: CommandPayload;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

type CommandType =
  | 'create_session' | 'send_prompt' | 'send_text'
  | 'get_output' | 'cancel' | 'terminate';

// AgentCommandResult
interface AgentCommandResult {
  id: string;
  command_id: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
}
```

---

## Layer 2: INFRA

### TASK-SE03: Command Repository

**파일**: `packages/office-server/src/session/commandRepository.ts`

**작업 내용**:
```typescript
class CommandRepository {
  constructor(private supabase: SupabaseClient) {}

  async createCommand(command: Omit<AgentCommand, 'id' | 'created_at'>): Promise<AgentCommand>;
  async getCommand(commandId: string): Promise<AgentCommand | null>;
  async updateCommandStatus(commandId: string, status: string): Promise<void>;
  async getCommandResult(commandId: string): Promise<AgentCommandResult | null>;
  async waitForResult(commandId: string, timeout: number): Promise<AgentCommandResult>;
}
```

---

### TASK-SE04: Session State Store

**파일**: `packages/office-server/src/session/sessionStore.ts`

**작업 내용**:
```typescript
class SessionStore {
  private sessions: Map<string, SessionInfo> = new Map();

  async getSession(sessionId: string): Promise<SessionInfo | null>;
  async setSession(session: SessionInfo): Promise<void>;
  async updateStatus(sessionId: string, status: SessionStatus): Promise<void>;
  async removeSession(sessionId: string): Promise<void>;
  async getSessionsByOffice(officeId: string): Promise<SessionInfo[]>;
  async getSessionByAgent(agentId: string): Promise<SessionInfo | null>;
}
```

---

## Layer 3: APPLICATION

### TASK-SE05: Session Pool Manager

**파일**: `packages/office-server/src/session/poolManager.ts`

**작업 내용**:
```typescript
interface PoolConfig {
  warmPoolSize: { [role: string]: number };
  maxColdSessions: number;
  idleTimeout: number;  // ms
}

class SessionPoolManager {
  constructor(
    private commandRepo: CommandRepository,
    private sessionStore: SessionStore,
    private config: PoolConfig
  ) {}

  // Warm Pool 초기화
  async initializeWarmPool(officeId: string): Promise<void>;

  // 세션 획득 (Warm → Cold)
  async acquireSession(officeId: string, agentId: string, role: string): Promise<SessionInfo>;

  // 세션 반환
  async releaseSession(sessionId: string): Promise<void>;

  // 유휴 세션 정리
  async cleanupIdleSessions(): Promise<void>;

  // 풀 상태 조회
  getPoolStatus(officeId: string): PoolStatus;
}
```

---

### TASK-SE06: Command Dispatcher

**파일**: `packages/office-server/src/session/commandDispatcher.ts`

**작업 내용**:
```typescript
class CommandDispatcher {
  constructor(
    private commandRepo: CommandRepository,
    private sessionStore: SessionStore
  ) {}

  // 세션 생성 명령
  async dispatchCreateSession(
    officeId: string,
    worktreePath: string
  ): Promise<AgentCommandResult>;

  // 프롬프트 전송
  async dispatchSendPrompt(
    sessionId: string,
    prompt: string,
    waitForCompletion?: boolean
  ): Promise<AgentCommandResult>;

  // 세션 종료
  async dispatchTerminate(sessionId: string): Promise<void>;

  // 명령 취소
  async dispatchCancel(sessionId: string): Promise<void>;

  // 결과 대기 (polling/subscribe)
  private async waitForResult(commandId: string): Promise<AgentCommandResult>;
}
```

---

### TASK-SE07: Session Orchestrator

**파일**: `packages/office-server/src/session/orchestrator.ts`

**작업 내용**:
```typescript
class SessionOrchestrator {
  constructor(
    private poolManager: SessionPoolManager,
    private dispatcher: CommandDispatcher,
    private jobService: JobService,
    private agentService: AgentService
  ) {}

  // Job 할당 시 세션 준비 & 프롬프트 전송
  async executeJob(job: Job): Promise<void> {
    const agent = await this.agentService.getAgent(job.agent_id);
    const session = await this.poolManager.acquireSession(
      job.office_id,
      job.agent_id,
      agent.persona.role
    );

    // 프롬프트 구성
    const prompt = this.buildPrompt(job, agent);

    // 전송 및 대기
    await this.dispatcher.dispatchSendPrompt(session.session_id, prompt, true);

    // 결과 처리
    await this.handleJobCompletion(job, session);
  }

  // 프롬프트 구성
  private buildPrompt(job: Job, agent: OfficeAgent): string;

  // 작업 완료 처리
  private async handleJobCompletion(job: Job, session: SessionInfo): Promise<void>;
}
```

---

### TASK-SE08: Circuit Breaker

**파일**: `packages/office-server/src/session/circuitBreaker.ts`

**작업 내용**:
```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailure: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void;
  private onFailure(): void;
  private shouldAttemptReset(): boolean;
}
```

---

## Layer 4: PRESENTATION

### TASK-SE09: Sessions API Routes

**파일**: `packages/office-server/src/api/routes/sessions.ts`

**작업 내용**:
- [ ] POST /api/offices/:id/sessions - 세션 생성
- [ ] GET /api/offices/:id/sessions - 세션 목록
- [ ] GET /api/offices/:id/sessions/:sessionId - 세션 상태
- [ ] DELETE /api/offices/:id/sessions/:sessionId - 세션 종료
- [ ] POST /api/offices/:id/sessions/:sessionId/prompt - 프롬프트 전송
- [ ] POST /api/offices/:id/sessions/:sessionId/cancel - 취소
- [ ] GET /api/offices/:id/sessions/:sessionId/output - 출력 조회

---

### TASK-SE10: Session Realtime Events

**파일**: `packages/office-server/src/realtime/sessionEvents.ts`

**작업 내용**:
```typescript
class SessionRealtimeEvents {
  constructor(private supabase: SupabaseClient) {}

  // 세션 상태 변경 브로드캐스트
  async broadcastSessionStatus(officeId: string, session: SessionInfo): Promise<void>;

  // 명령 결과 브로드캐스트
  async broadcastCommandResult(officeId: string, result: AgentCommandResult): Promise<void>;

  // 세션 출력 스트림 (부분)
  async broadcastSessionOutput(officeId: string, sessionId: string, output: string): Promise<void>;
}
```

---

## semo-remote-client Integration Tasks

> 이 태스크들은 `semo-remote-client` 패키지에서 구현됩니다.

### TASK-SE-CLIENT01: Office Subscriber

**파일**: `/tmp/semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
- [ ] Supabase Realtime 구독 (agent_commands)
- [ ] 명령 타입별 핸들러 분기
- [ ] 결과 저장 (agent_command_results)

### TASK-SE-CLIENT02: iTerm2 API Wrapper

**파일**: `/tmp/semo-remote-client/src/main/itermApi.ts`

**작업 내용**:
- [ ] createTab() - 새 탭 생성
- [ ] sendText() - 텍스트 전송
- [ ] getOutput() - 출력 조회
- [ ] sendKeystrokes() - 키 입력
- [ ] closeTab() - 탭 종료

---

## Completion Checklist

- [ ] agent_commands, agent_command_results 테이블 생성
- [ ] Command Repository 동작
- [ ] Session Store 동작
- [ ] Session Pool Manager 동작
- [ ] Command Dispatcher 동작
- [ ] Session Orchestrator 동작
- [ ] Circuit Breaker 동작
- [ ] Sessions API 엔드포인트 동작
- [ ] Realtime Events 브로드캐스트 동작
- [ ] semo-remote-client Office Subscriber 동작
- [ ] E2E: Job 할당 → 세션 생성 → 프롬프트 전송 → 완료 확인
