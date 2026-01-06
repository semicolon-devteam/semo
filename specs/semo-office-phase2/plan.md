# Semo Office Phase 2 - Technical Plan

> Office Server ↔ semo-remote-client 통합 기술 설계

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Semo Office Server                            │
│                        (Express + Supabase)                          │
│                                                                      │
│  Task Decomposer ─→ Job Scheduler ─→ Session Executor               │
│                                              │                       │
└──────────────────────────────────────────────│───────────────────────┘
                                               │ INSERT agent_commands
                                               ▼
                      ┌────────────────────────────────────────┐
                      │         Supabase (PostgreSQL)          │
                      │                                        │
                      │  agent_commands (Realtime 활성화)      │
                      │  agent_command_results                 │
                      │  agent_sessions                        │
                      └────────────────────────────────────────┘
                                               │
                                               │ Realtime Subscribe
                                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     semo-remote-client (Electron)                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Office Command Subscriber                     │ │
│  │  - agent_commands 테이블 구독                                   │ │
│  │  - office_id 필터링                                            │ │
│  │  - command_type별 핸들러 실행                                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│       ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│       │ iTerm Tab│    │ iTerm Tab│    │ iTerm Tab│                 │
│       │ Agent:FE │    │ Agent:BE │    │ Agent:QA │                 │
│       │ Worktree │    │ Worktree │    │ Worktree │                 │
│       └──────────┘    └──────────┘    └──────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DDD Layer Mapping

### Layer 0: CONFIG (설정)

| 구성 요소 | 파일 | 설명 |
|-----------|------|------|
| 환경변수 | `.env` | SEMO_OFFICE_MODE, SEMO_OFFICE_ID |
| DB 스키마 | `005_office_commands.sql` | agent_commands, agent_command_results, agent_sessions |

### Layer 1: DATA (데이터)

| 구성 요소 | 파일 | 설명 |
|-----------|------|------|
| Types | `src/main/officeSubscriber.ts` | AgentCommand, CommandResult, AgentSession 인터페이스 |
| DB Tables | Supabase | 명령/결과/세션 테이블 |

### Layer 2: INFRA (인프라)

| 구성 요소 | 파일 | 설명 |
|-----------|------|------|
| Supabase Client | `src/main/supabase.ts` | 기존 Supabase 클라이언트 재사용 |
| Realtime Channel | `officeSubscriber.ts` | postgres_changes 구독 |
| Polling Fallback | `officeSubscriber.ts` | 2초 간격 폴링 |

### Layer 3: APPLICATION (애플리케이션)

| 구성 요소 | 파일 | 설명 |
|-----------|------|------|
| Command Handlers | `officeSubscriber.ts` | 6가지 명령 타입 핸들러 |
| Session Management | `officeSubscriber.ts` | 세션 생성/등록/종료 |
| IPC Handlers | `index.ts` | office:get-status, office:subscribe, office:unsubscribe |

---

## Technical Approach

### 1. Office Command Subscriber 모듈

**위치**: `semo-remote-client/src/main/officeSubscriber.ts`

**핵심 함수**:

```typescript
// 초기화 (의존성 주입)
export function initializeOfficeSubscriber(deps: OfficeDependencies): void;

// 구독 시작
export async function subscribeToOfficeCommands(officeId: string): Promise<void>;

// 구독 중지
export async function unsubscribeFromOfficeCommands(): Promise<void>;

// 상태 조회
export function isOfficeModeActive(): boolean;
export function getActiveOfficeId(): string | null;
```

**의존성 주입 패턴**:

```typescript
interface OfficeDependencies {
  supabase: SupabaseClient;
  sendToClaudeCode: SendToClaudeCodeFn;
  createNewItermTab: CreateNewItermTabFn;
  sendToIterm: SendToItermFn;
  getSessionOutput: GetSessionOutputFn;
}
```

### 2. 명령 처리 흐름

```
[Realtime INSERT 수신] or [Polling 발견]
    ↓
processingCommands Set에서 중복 체크
    ↓
status → 'processing' 업데이트
    ↓
command_type별 핸들러 실행
    ↓
agent_command_results INSERT
    ↓
status → 'completed' or 'failed' 업데이트
    ↓
processingCommands에서 제거
```

### 3. 핸들러 구현 상세

#### handleCreateSession

```typescript
async function handleCreateSession(command: AgentCommand): Promise<CommandResult> {
  // 1. 새 iTerm 탭 생성 + Claude Code 실행
  const result = await deps.createNewItermTab(worktree_path, true);

  // 2. agent_sessions에 등록
  await deps.supabase.from('agent_sessions').insert({...});

  // 3. Claude Code 초기화 대기 (5초)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 4. 초기 프롬프트 전송
  await deps.sendToClaudeCode(sessionId, initial_prompt, 'applescript');
}
```

#### handleSendPrompt

```typescript
async function handleSendPrompt(command: AgentCommand): Promise<CommandResult> {
  // AppleScript를 통해 Claude Code 입력창에 프롬프트 전송
  const result = await deps.sendToClaudeCode(
    command.iterm_session_id,
    prompt,
    'applescript'
  );
}
```

### 4. 폴링 Fallback

```typescript
// Realtime 실패 시 활성화
function startPolling(officeId: string): void {
  pollingInterval = setInterval(async () => {
    const { data: commands } = await deps.supabase
      .from('agent_commands')
      .select('*')
      .eq('office_id', officeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    // 새 명령 처리
    for (const command of commands) {
      if (!processingCommands.has(command.id)) {
        processingCommands.add(command.id);
        handleCommand(command);
      }
    }
  }, 2000);
}
```

### 5. main/index.ts 통합

```typescript
// 1. Office 환경변수
const OFFICE_MODE = process.env.SEMO_OFFICE_MODE === 'true';
const OFFICE_ID = process.env.SEMO_OFFICE_ID;

// 2. initializeSupabase() 내에서 초기화
if (OFFICE_MODE && OFFICE_ID) {
  initializeOfficeSubscriber({
    supabase,
    sendToClaudeCode,
    createNewItermTab,
    sendToIterm,
    getSessionOutput,
  });
  await subscribeToOfficeCommands(OFFICE_ID);
}

// 3. IPC 핸들러 등록
ipcMain.handle('office:get-status', () => {...});
ipcMain.handle('office:subscribe', async (_, officeId) => {...});
ipcMain.handle('office:unsubscribe', async () => {...});

// 4. before-quit에서 정리
app.on('before-quit', async () => {
  if (isOfficeModeActive()) {
    await unsubscribeFromOfficeCommands();
  }
});
```

---

## DB Schema (Phase 2 추가)

### 005_office_commands.sql

```sql
-- agent_commands: Office Server → semo-remote-client
CREATE TABLE agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  agent_id UUID REFERENCES office_agents(id),
  job_id UUID REFERENCES job_queue(id),
  iterm_session_id VARCHAR(100),
  command_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_seconds INT DEFAULT 300
);

-- agent_command_results: semo-remote-client → Office Server
CREATE TABLE agent_command_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES agent_commands(id),
  success BOOLEAN NOT NULL,
  output TEXT,
  pr_number INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- agent_sessions: iTerm 세션 등록
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  agent_id UUID REFERENCES office_agents(id),
  worktree_id UUID REFERENCES worktrees(id),
  iterm_session_id VARCHAR(100) NOT NULL UNIQUE,
  iterm_tab_name VARCHAR(200),
  is_claude_code BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  cwd VARCHAR(500),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_command_results;

-- 인덱스
CREATE INDEX idx_agent_commands_office_status ON agent_commands(office_id, status);
CREATE INDEX idx_agent_commands_created ON agent_commands(created_at);
CREATE INDEX idx_agent_sessions_office ON agent_sessions(office_id);
```

---

## Risk Mitigation

### Realtime 연결 불안정

- **완화**: 폴링 fallback 자동 활성화
- **감지**: subscription status 모니터링 (TIMED_OUT, CHANNEL_ERROR)

### Claude Code 초기화 지연

- **완화**: 5초 대기 후 프롬프트 전송
- **개선 (Phase 3)**: idle 상태 감지 로직 추가

### 중복 명령 처리

- **완화**: processingCommands Set으로 중복 방지
- **추가**: status가 pending인 경우만 처리

---

## Testing Strategy

### 단위 테스트

- 각 핸들러 함수 개별 테스트
- 의존성 모킹 (supabase, iTerm 함수)

### 통합 테스트

1. Office Server에서 명령 INSERT
2. semo-remote-client에서 수신 확인
3. iTerm 탭 생성 확인
4. 결과 저장 확인

### E2E 테스트

```bash
# 1. Office 생성
curl -X POST http://localhost:3001/api/offices \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Office", "github_org": "test", "github_repo": "test-repo"}'

# 2. 작업 요청
curl -X POST http://localhost:3001/api/offices/{id}/tasks \
  -H "Content-Type: application/json" \
  -d '{"task": "로그인 기능 구현해줘"}'

# 3. Agent 상태 확인
curl http://localhost:3001/api/offices/{id}/agents
```

---

## Files to Create/Modify

### 신규 파일

| 파일 | 설명 |
|------|------|
| `semo-remote-client/src/main/officeSubscriber.ts` | Office Command Subscriber |
| `semo-system/semo-remote/db/migrations/005_office_commands.sql` | DB 스키마 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `semo-remote-client/src/main/index.ts` | Office Mode 통합 |
| `semo-remote-client/src/preload/index.ts` | semoOffice API 노출 (선택) |

---

## Timeline Estimate

| Phase | 작업 | 예상 |
|-------|------|------|
| CONFIG | DB 마이그레이션, 환경변수 | 0.5일 |
| DATA | 타입 정의 | 0.5일 |
| INFRA | Realtime 구독, 폴링 | 1일 |
| APPLICATION | 핸들러 구현, IPC | 1.5일 |
| TESTS | 통합 테스트 | 1일 |
| **Total** | | **4.5일** |
