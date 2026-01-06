# Semo Office + semo-remote-client 통합 가이드

> Office Server와 semo-remote-client 간의 통합을 위한 기술 문서

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Semo Office Server                            │
│                        (Express + Supabase)                          │
│                                                                      │
│  Task Decomposer ─→ Job Scheduler ─→ Session Executor               │
│                                              │                       │
└──────────────────────────────────────────────│───────────────────────┘
                                               │
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

## DB 스키마

### 새 테이블 (005_office_commands.sql)

#### agent_commands

Office Server → semo-remote-client 명령 전달

```sql
CREATE TABLE agent_commands (
  id UUID PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES offices(id),
  agent_id UUID REFERENCES office_agents(id),
  job_id UUID REFERENCES job_queue(id),
  iterm_session_id VARCHAR(100),
  command_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_seconds INT DEFAULT 300
);
```

**command_type 종류:**

| Type | 설명 | Payload |
|------|------|---------|
| `create_session` | 새 Claude Code 세션 생성 | `{ worktree_path, persona_name, initial_prompt }` |
| `send_prompt` | 기존 세션에 프롬프트 전송 | `{ prompt, method: "applescript" }` |
| `send_text` | 일반 텍스트 전송 | `{ text }` |
| `get_output` | 세션 출력 조회 | `{ lines: 100 }` |
| `cancel` | 현재 작업 취소 (Ctrl+C) | `{}` |
| `terminate` | 세션 종료 | `{}` |

#### agent_command_results

semo-remote-client → Office Server 결과 전달

```sql
CREATE TABLE agent_command_results (
  id UUID PRIMARY KEY,
  command_id UUID NOT NULL REFERENCES agent_commands(id),
  success BOOLEAN NOT NULL,
  output TEXT,
  pr_number INT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

#### agent_sessions

iTerm 세션 등록 (semo-remote-client가 관리)

```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES offices(id),
  agent_id UUID REFERENCES office_agents(id),
  worktree_id UUID REFERENCES worktrees(id),
  iterm_session_id VARCHAR(100) NOT NULL UNIQUE,
  iterm_tab_name VARCHAR(200),
  is_claude_code BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  cwd VARCHAR(500),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

## semo-remote-client 구현 가이드

### 1. Office Command Subscriber 추가

`src/main/officeSubscriber.ts` (신규)

```typescript
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { sendToClaudeCode, createNewTab } from './itermController';

interface AgentCommand {
  id: string;
  office_id: string;
  agent_id?: string;
  job_id?: string;
  iterm_session_id?: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: string;
  timeout_seconds: number;
}

let officeChannel: RealtimeChannel | null = null;
const activeOfficeId: string | null = null;

/**
 * Office 명령 구독 시작
 */
export async function subscribeToOfficeCommands(officeId: string): Promise<void> {
  if (officeChannel) {
    await supabase.removeChannel(officeChannel);
  }

  officeChannel = supabase
    .channel(`office_commands:${officeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_commands',
        filter: `office_id=eq.${officeId}`,
      },
      async (payload) => {
        const command = payload.new as AgentCommand;
        await handleCommand(command);
      }
    )
    .subscribe();

  console.log(`[Office] Subscribed to commands for office: ${officeId}`);
}

/**
 * 명령 처리
 */
async function handleCommand(command: AgentCommand): Promise<void> {
  console.log(`[Office] Received command: ${command.command_type}`);

  // 상태를 processing으로 업데이트
  await supabase
    .from('agent_commands')
    .update({ status: 'processing', processed_at: new Date().toISOString() })
    .eq('id', command.id);

  try {
    let result: CommandResult;

    switch (command.command_type) {
      case 'create_session':
        result = await handleCreateSession(command);
        break;
      case 'send_prompt':
        result = await handleSendPrompt(command);
        break;
      case 'send_text':
        result = await handleSendText(command);
        break;
      case 'get_output':
        result = await handleGetOutput(command);
        break;
      case 'cancel':
        result = await handleCancel(command);
        break;
      case 'terminate':
        result = await handleTerminate(command);
        break;
      default:
        result = { success: false, error: `Unknown command: ${command.command_type}` };
    }

    // 결과 저장
    await saveCommandResult(command.id, result);

    // 명령 상태 업데이트
    await supabase
      .from('agent_commands')
      .update({
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        error_message: result.error,
      })
      .eq('id', command.id);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('agent_commands')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('id', command.id);

    await saveCommandResult(command.id, { success: false, error: errorMessage });
  }
}

interface CommandResult {
  success: boolean;
  output?: string;
  prNumber?: number;
  sessionId?: string;
  error?: string;
}

/**
 * create_session 핸들러
 */
async function handleCreateSession(command: AgentCommand): Promise<CommandResult> {
  const { worktree_path, persona_name, initial_prompt } = command.payload as {
    worktree_path: string;
    persona_name: string;
    initial_prompt: string;
  };

  // 1. 새 iTerm 탭 생성 + Claude Code 실행
  const result = await createNewTab(worktree_path, true);

  if (!result.success) {
    return { success: false, error: 'Failed to create iTerm tab' };
  }

  const sessionId = result.session.id;

  // 2. agent_sessions에 등록
  await supabase.from('agent_sessions').insert({
    office_id: command.office_id,
    agent_id: command.agent_id,
    iterm_session_id: sessionId,
    iterm_tab_name: `Agent: ${persona_name}`,
    is_claude_code: true,
    status: 'active',
    cwd: worktree_path,
  });

  // 3. 초기 프롬프트 전송 (Claude Code 초기화 대기 후)
  await new Promise(resolve => setTimeout(resolve, 3000));

  const sendResult = await sendToClaudeCode(sessionId, initial_prompt, 'applescript');

  return {
    success: sendResult.success,
    sessionId,
    output: sendResult.success ? 'Session created and prompt sent' : 'Session created but prompt failed',
  };
}

/**
 * send_prompt 핸들러
 */
async function handleSendPrompt(command: AgentCommand): Promise<CommandResult> {
  const { prompt, method } = command.payload as {
    prompt: string;
    method: 'applescript' | 'direct';
  };

  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  const result = await sendToClaudeCode(
    command.iterm_session_id,
    prompt,
    method || 'applescript'
  );

  // 출력 대기 (작업 완료까지)
  // TODO: 완료 감지 로직 추가 필요

  return {
    success: result.success,
    output: 'Prompt sent',
  };
}

/**
 * send_text 핸들러
 */
async function handleSendText(command: AgentCommand): Promise<CommandResult> {
  const { text } = command.payload as { text: string };

  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  const result = await sendToClaudeCode(command.iterm_session_id, text, 'direct');

  return { success: result.success };
}

/**
 * get_output 핸들러
 */
async function handleGetOutput(command: AgentCommand): Promise<CommandResult> {
  const { lines } = command.payload as { lines?: number };

  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  const result = await getSessionOutput(command.iterm_session_id, lines || 100);

  return {
    success: result.success,
    output: result.lines?.join('\n'),
  };
}

/**
 * cancel 핸들러
 */
async function handleCancel(command: AgentCommand): Promise<CommandResult> {
  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  // Ctrl+C 전송
  const result = await sendText(command.iterm_session_id, '\x03');

  return { success: result.success };
}

/**
 * terminate 핸들러
 */
async function handleTerminate(command: AgentCommand): Promise<CommandResult> {
  if (!command.iterm_session_id) {
    return { success: false, error: 'No iTerm session ID provided' };
  }

  // 세션 상태 업데이트
  await supabase
    .from('agent_sessions')
    .update({ status: 'disconnected' })
    .eq('iterm_session_id', command.iterm_session_id);

  // exit 명령 전송
  const result = await sendText(command.iterm_session_id, 'exit\n');

  return { success: result.success };
}

/**
 * 결과 저장
 */
async function saveCommandResult(commandId: string, result: CommandResult): Promise<void> {
  await supabase.from('agent_command_results').insert({
    command_id: commandId,
    success: result.success,
    output: result.output,
    pr_number: result.prNumber,
    metadata: {
      session_id: result.sessionId,
    },
  });
}
```

### 2. main/index.ts 수정

```typescript
// 기존 코드에 추가
import { subscribeToOfficeCommands } from './officeSubscriber';

// Office 모드 활성화 (환경변수 또는 설정)
const OFFICE_MODE = process.env.SEMO_OFFICE_MODE === 'true';
const OFFICE_ID = process.env.SEMO_OFFICE_ID;

// 앱 초기화 후
if (OFFICE_MODE && OFFICE_ID) {
  subscribeToOfficeCommands(OFFICE_ID);
  console.log(`[SEMO] Office mode enabled for: ${OFFICE_ID}`);
}
```

### 3. 환경변수 추가

`.env`:
```env
SEMO_OFFICE_MODE=true
SEMO_OFFICE_ID=your-office-uuid
```

## 테스트 방법

### 1. Supabase 마이그레이션 실행

```bash
# Supabase SQL Editor에서 실행
cat semo-system/semo-remote/db/migrations/005_office_commands.sql
```

### 2. Office Server 실행

```bash
cd semo/packages/office-server
npm run dev
```

### 3. semo-remote-client 실행

```bash
# OFFICE_MODE 환경변수 설정 후 실행
cd semo-remote-client
SEMO_OFFICE_MODE=true SEMO_OFFICE_ID=xxx npm run dev
```

### 4. 테스트 명령 전송

```bash
# Office 생성
curl -X POST http://localhost:3001/api/offices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Office",
    "github_org": "test",
    "github_repo": "test-repo",
    "repo_path": "/path/to/repo"
  }'

# 작업 요청
curl -X POST http://localhost:3001/api/offices/{office_id}/tasks \
  -H "Content-Type: application/json" \
  -d '{"task": "로그인 기능 구현해줘"}'
```

## 흐름 요약

```
1. 사용자: "로그인 기능 구현해줘"
    ↓
2. Task Decomposer: Job 분해 (FE, BE, QA)
    ↓
3. Job Scheduler: ready 상태 Job 감지
    ↓
4. Session Executor: agent_commands INSERT
    ↓
5. semo-remote-client: Realtime 수신
    ↓
6. iTerm2 Python API: 새 탭 생성 + Claude Code 실행
    ↓
7. Claude Code: 프롬프트 수신 → 코드 작성 → PR 생성
    ↓
8. semo-remote-client: agent_command_results INSERT
    ↓
9. Session Executor: Realtime 수신 → Job 완료 처리
    ↓
10. Office UI: Agent 상태 업데이트
```

## 다음 단계

1. **semo-remote-client PR 생성**: Office Subscriber 기능 추가
2. **완료 감지 로직**: Claude Code 작업 완료 감지 (idle 상태, PR 생성 감지)
3. **에러 복구**: 네트워크 끊김, 세션 만료 등 처리
4. **UI 연동**: Office UI에서 실시간 상태 표시
