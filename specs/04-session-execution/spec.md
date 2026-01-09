# 04-Session Execution: Claude Code 세션 관리

> Agent별 Claude Code 세션 생성, 제어, 모니터링

---

## Overview

각 Agent는 독립된 Claude Code 세션에서 작업을 수행합니다.
Office Server는 semo-remote-client를 통해 **node-pty** 기반 터미널 세션으로 Claude Code를 원격 제어합니다.

> **Note**: Claude Max 구독 계정이 로그인된 맥북에서 Claude Code CLI를 직접 실행합니다. API 호출이 아닌 CLI 기반으로 동작합니다.

### 아키텍처

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Office Server                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Session Pool │    │  Job Queue   │    │   Realtime   │       │
│  │   Manager    │───▶│  Scheduler   │───▶│  Broadcast   │       │
│  └──────┬───────┘    └──────────────┘    └──────────────┘       │
│         │                                                        │
│         │ INSERT agent_commands                                  │
│         ▼                                                        │
│  ┌──────────────────────────────────────┐                       │
│  │          Supabase (Realtime)          │                       │
│  │  ├─ agent_commands (명령)             │                       │
│  │  └─ agent_command_results (응답)      │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Realtime Subscribe
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   semo-remote-client (Electron)                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Office     │    │   node-pty   │    │   Output     │       │
│  │  Subscriber  │───▶│  Terminal    │───▶│  Collector   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                              │                                   │
│                              ▼                                   │
│                    ┌──────────────┐                             │
│                    │ Claude Code  │                             │
│                    │   Session    │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### 터미널 백엔드 선택

| 방식                    | 장점                     | 단점                 |
|-------------------------|--------------------------|----------------------|
| **node-pty (권장)**     | 크로스플랫폼, 진짜 PTY   | npm 네이티브 모듈    |
| child_process           | 의존성 없음              | PTY 미지원           |
| ~~iTerm2 Python API~~   | -                        | macOS 전용, 비권장   |

> **결정**: `node-pty` 사용. macOS/Linux/Windows 지원, headless 환경 가능.

---

## User Stories

### US-SE01: Agent 세션 생성

> "Office에 Agent가 추가되면 해당 Agent용 Claude Code 세션을 생성한다"

**AC**:
- Agent 할당 시 자동으로 세션 생성
- Worktree 경로에서 Claude Code 실행
- 세션 ID를 DB에 기록

### US-SE02: 프롬프트 전송

> "Job이 할당된 Agent에게 작업 프롬프트를 전송한다"

**AC**:
- Job description + 컨텍스트를 프롬프트로 변환
- 활성 세션에 프롬프트 전송
- 전송 결과 확인

### US-SE03: 세션 출력 모니터링

> "Agent 세션의 실시간 출력을 모니터링한다"

**AC**:
- Claude Code 출력 스트림 캡처
- 중요 이벤트 파싱 (완료, 오류, 대기)
- Realtime으로 상태 브로드캐스트

### US-SE04: 세션 풀 관리

> "효율적인 세션 관리를 위해 Warm/Cold Pool을 운영한다"

**AC**:
- 자주 사용되는 역할은 Warm Pool (미리 생성)
- 버스트 트래픽은 Cold Pool (온디맨드)
- 유휴 세션 자동 정리

### US-SE05: 세션 종료/복구

> "세션 종료 및 오류 복구를 관리한다"

**AC**:

- Job 완료 시 세션 유지/해제 결정
- 오류 발생 시 자동 재시작 (Circuit Breaker)
- 세션 상태 정기 헬스체크

---

### US-SE06: 작업 완료 감지

> "Agent의 작업 완료를 자동으로 감지하여 Job Scheduler에 알린다"

**AC**:

- Claude Code 출력 스트림에서 완료 시그널 감지
- PR 생성 완료, 커밋 완료 등 특정 패턴 인식
- 완료 시 Job 상태를 `done`으로 업데이트
- 후속 Job 활성화 트리거

**감지 패턴**:

```typescript
const COMPLETION_PATTERNS = [
  // PR 생성 완료
  /Created pull request #(\d+)/i,
  // 커밋 완료
  /\[.*\] \d+ files? changed/i,
  // Claude Code 작업 완료
  /Task completed successfully/i,
  // 사용자 정의 완료 마커
  /\[SEMO:DONE\]/i,
];

const ERROR_PATTERNS = [
  // 빌드 실패
  /Build failed/i,
  // 테스트 실패
  /Tests? failed/i,
  // 에러 발생
  /Error:/i,
  /Exception:/i,
];
```

**구현**:

```typescript
class OutputMonitor {
  private jobId: string;
  private sessionId: string;
  private sessionManager: SessionManager;

  async monitorOutput(): Promise<void> {
    const output = await this.sessionManager.getOutput(this.sessionId);

    // 완료 패턴 검사
    for (const pattern of COMPLETION_PATTERNS) {
      const match = output.match(pattern);
      if (match) {
        await this.handleCompletion(match);
        return;
      }
    }

    // 에러 패턴 검사
    for (const pattern of ERROR_PATTERNS) {
      const match = output.match(pattern);
      if (match) {
        await this.handleError(match);
        return;
      }
    }
  }

  private async handleCompletion(match: RegExpMatchArray): Promise<void> {
    // 1. PR 번호 추출 (있는 경우)
    const prNumber = this.extractPrNumber(match);

    // 2. Job 상태 업데이트
    await this.db.update('job_queue', this.jobId, {
      status: 'done',
      pr_number: prNumber,
      completed_at: new Date().toISOString()
    });

    // 3. Job Scheduler에 완료 알림
    await this.scheduler.onJobComplete(this.jobId);

    // 4. Realtime 브로드캐스트
    await this.realtime.broadcast({
      type: 'job_completed',
      job_id: this.jobId,
      pr_number: prNumber
    });
  }
}
```

---

### US-SE07: Persona 프롬프트 주입

> "세션 생성 시 Agent의 Persona를 시스템 프롬프트로 주입한다"

**AC**:

- 세션 생성 시 Persona 정보 조회
- CLAUDE.md 파일에 Persona 프롬프트 추가
- scope_patterns 기반 작업 범위 제한
- core_skills 기반 사용 가능 스킬 제한

**주입 방식**:

```text
[세션 생성 요청]
       │
       ▼
┌─────────────────┐
│ Persona 조회    │ ← DB agent_personas 테이블
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Worktree 준비   │
│ ├─ .claude/     │
│ │  └─ CLAUDE.md │ ← Persona 프롬프트 주입
│ └─ {files}      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Claude Code 실행│ ← 주입된 Persona로 동작
└─────────────────┘
```

**Persona 프롬프트 템플릿**:

```markdown
# Agent Persona

{persona_prompt}

## 담당 영역

이 Agent는 다음 파일 패턴에 대해서만 작업합니다:
{scope_patterns}

다른 영역의 파일은 수정하지 마세요.

## 사용 가능 스킬

- {core_skills}

## 협업 규칙

- 작업 완료 시 `[SEMO:DONE]` 마커를 출력하세요
- 다른 Agent에게 요청이 필요하면 메시지를 남기세요
- PR 생성 시 `[{role}]` 프리픽스를 사용하세요
```

**구현**:

```typescript
class PersonaInjector {
  async injectPersona(
    worktreePath: string,
    persona: AgentPersona
  ): Promise<void> {
    const claudeMdPath = path.join(worktreePath, '.claude', 'CLAUDE.md');

    // 1. 기존 CLAUDE.md 읽기 (있는 경우)
    let existingContent = '';
    if (await fs.exists(claudeMdPath)) {
      existingContent = await fs.readFile(claudeMdPath, 'utf-8');
    }

    // 2. Persona 섹션 생성
    const personaSection = this.buildPersonaSection(persona);

    // 3. CLAUDE.md에 주입
    const newContent = `${personaSection}\n\n---\n\n${existingContent}`;
    await fs.writeFile(claudeMdPath, newContent);
  }

  private buildPersonaSection(persona: AgentPersona): string {
    return `
# Agent Persona: ${persona.name}

${persona.persona_prompt}

## 담당 영역

이 Agent는 다음 파일 패턴에 대해서만 작업합니다:
${persona.scope_patterns.map(p => `- \`${p}\``).join('\n')}

다른 영역의 파일은 수정하지 마세요.

## 사용 가능 스킬

${persona.core_skills.map(s => `- ${s}`).join('\n')}

## 협업 규칙

- 작업 완료 시 \`[SEMO:DONE]\` 마커를 출력하세요
- 다른 Agent에게 요청이 필요하면 메시지를 남기세요
- PR 생성 시 \`[${persona.role}]\` 프리픽스를 사용하세요
`;
  }
}
```

---

## Data Models

### SessionInfo

```typescript
interface SessionInfo {
  session_id: string;
  agent_id: string;
  worktree_id: string;
  pty_pid: number;           // node-pty 프로세스 PID
  status: SessionStatus;
  created_at: string;
  last_activity_at: string;
}

type SessionStatus =
  | 'creating'      // 생성 중
  | 'ready'         // 준비 완료 (대기)
  | 'executing'     // 프롬프트 실행 중
  | 'waiting_input' // 사용자 입력 대기
  | 'error'         // 오류 상태
  | 'terminated';   // 종료됨
```

### AgentCommand

```typescript
// Office Server → semo-remote-client
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
  | 'create_session'  // 새 세션 생성
  | 'send_prompt'     // 프롬프트 전송
  | 'send_text'       // 일반 텍스트 전송
  | 'get_output'      // 출력 조회
  | 'cancel'          // Ctrl+C
  | 'terminate';      // 세션 종료

interface CommandPayload {
  // create_session
  worktree_path?: string;

  // send_prompt / send_text
  text?: string;
  wait_for_completion?: boolean;
}
```

### AgentCommandResult

```typescript
// semo-remote-client → Office Server
interface AgentCommandResult {
  id: string;
  command_id: string;
  success: boolean;
  result?: {
    session_id?: string;
    output?: string;
    status?: SessionStatus;
  };
  error?: string;
  created_at: string;
}
```

---

## DB Schema

### 테이블: agent_commands

```sql
CREATE TABLE agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  session_id VARCHAR(100),
  command_type VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_commands_office ON agent_commands(office_id);
CREATE INDEX idx_agent_commands_status ON agent_commands(status);
```

### 테이블: agent_command_results

```sql
CREATE TABLE agent_command_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID REFERENCES agent_commands(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  result JSONB DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_command_results_command ON agent_command_results(command_id);
```

---

## API Endpoints

### 세션 관리

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/sessions` | 세션 생성 요청 |
| GET | `/api/offices/:id/sessions` | 세션 목록 조회 |
| GET | `/api/offices/:id/sessions/:sessionId` | 세션 상태 조회 |
| DELETE | `/api/offices/:id/sessions/:sessionId` | 세션 종료 |

### 명령 전송

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/sessions/:sessionId/prompt` | 프롬프트 전송 |
| POST | `/api/offices/:id/sessions/:sessionId/cancel` | 실행 취소 |
| GET | `/api/offices/:id/sessions/:sessionId/output` | 출력 조회 |

---

## semo-remote-client 연동

### Office Subscriber

```typescript
// packages/semo-remote-client/src/main/officeSubscriber.ts
class OfficeSubscriber {
  private supabase: SupabaseClient;
  private sessionManager: SessionManager;

  async subscribe(officeId: string): Promise<void> {
    this.supabase
      .channel(`office:${officeId}:commands`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_commands',
        filter: `office_id=eq.${officeId}`
      }, this.handleCommand)
      .subscribe();
  }

  private async handleCommand(payload: AgentCommand): Promise<void> {
    switch (payload.command_type) {
      case 'create_session':
        await this.createSession(payload);
        break;
      case 'send_prompt':
        await this.sendPrompt(payload);
        break;
      // ...
    }
  }

  private async createSession(command: AgentCommand): Promise<void> {
    const { worktree_path } = command.payload;

    // node-pty로 새 터미널 세션 생성
    const session = await this.sessionManager.create(worktree_path);

    // Claude Code 실행
    await this.sessionManager.execute(session.id, 'claude');

    // 결과 저장
    await this.supabase.from('agent_command_results').insert({
      command_id: command.id,
      success: true,
      result: { session_id: session.id, pty_pid: session.pty_pid }
    });
  }
}
```

### node-pty 기반 Session Manager

```typescript
// packages/semo-remote-client/src/main/sessionManager.ts
import { spawn, IPty } from 'node-pty';

interface PtySession {
  id: string;
  pty: IPty;
  outputBuffer: string;
}

class SessionManager {
  private sessions: Map<string, PtySession> = new Map();

  async create(workingDir: string): Promise<{ id: string; pty_pid: number }> {
    const sessionId = crypto.randomUUID();

    // node-pty로 터미널 세션 생성
    const pty = spawn('zsh', [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: workingDir,
      env: process.env,
    });

    // 출력 버퍼링
    const session: PtySession = { id: sessionId, pty, outputBuffer: '' };
    pty.onData((data) => {
      session.outputBuffer += data;
      this.onOutput(sessionId, data);
    });

    this.sessions.set(sessionId, session);

    return { id: sessionId, pty_pid: pty.pid };
  }

  async execute(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.pty.write(command + '\n');
  }

  async sendKeystrokes(sessionId: string, keys: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Ctrl+C = '\x03'
    session.pty.write(keys);
  }

  async getOutput(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    return session?.outputBuffer ?? '';
  }

  async terminate(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.sessions.delete(sessionId);
    }
  }

  private onOutput(sessionId: string, data: string): void {
    // OutputMonitor에 전달하여 완료/에러 패턴 감지
  }
}
```

---

## Session Pool Strategy

### Warm Pool

| 역할 | 기본 세션 수 | 설명 |
|------|-------------|------|
| FE | 1 | Frontend 작업 |
| BE | 1 | Backend 작업 |
| QA | 1 | 테스트 작업 |
| **Total** | **3** | Office당 기본 세션 |

### Cold Pool

- 동적 생성: Job 큐 대기 시 온디맨드 생성
- 자동 정리: 10분 유휴 시 종료
- 최대 제한: Office당 6개

### Pool Manager

```typescript
class SessionPoolManager {
  private warmPool: Map<string, SessionInfo[]>;  // role -> sessions
  private coldPool: SessionInfo[];

  async acquireSession(officeId: string, role: string): Promise<SessionInfo> {
    // 1. Warm Pool에서 가용 세션 확인
    const warm = this.warmPool.get(role)?.find(s => s.status === 'ready');
    if (warm) return warm;

    // 2. Cold Pool에서 생성
    return this.createColdSession(officeId, role);
  }

  async releaseSession(sessionId: string): Promise<void> {
    // 세션 상태 초기화 후 Pool 반환
  }

  async cleanupIdleSessions(): Promise<void> {
    // 10분 이상 유휴 세션 정리
  }
}
```

---

## Error Handling

### Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 3;      // 연속 실패 허용 횟수
  resetTimeout: 60000;      // 1분 후 재시도
  halfOpenRequests: 1;      // Half-Open 상태에서 테스트 요청 수
}
```

### 재시도 전략

| 오류 유형           | 재시도   | 동작           |
|---------------------|----------|----------------|
| 세션 생성 실패      | 최대 3회 | 지수 백오프    |
| 프롬프트 타임아웃   | 최대 2회 | 세션 재시작    |
| PTY 프로세스 종료   | 최대 3회 | 세션 재생성    |

---

## Sequence Diagram

### 세션 생성 및 프롬프트 전송

```text
Office Server          Supabase           semo-remote-client      node-pty
     │                    │                      │                   │
     │ INSERT command     │                      │                   │
     │───────────────────▶│                      │                   │
     │                    │  Realtime notify     │                   │
     │                    │─────────────────────▶│                   │
     │                    │                      │  spawn(zsh)       │
     │                    │                      │──────────────────▶│
     │                    │                      │                   │
     │                    │                      │◀──────────────────│
     │                    │                      │  write(claude)    │
     │                    │                      │──────────────────▶│
     │                    │  INSERT result       │                   │
     │                    │◀─────────────────────│                   │
     │◀───────────────────│                      │                   │
     │  Realtime notify   │                      │                   │
```

---

## Related Specs

- [01-Core](../01-core/spec.md) - Agent 인스턴스
- [02-Task Decomposer](../02-task-decomposer/spec.md) - Job 생성
- [03-Worktree](../03-worktree/spec.md) - 작업 디렉토리
- [05-PR Workflow](../05-pr-workflow/spec.md) - 작업 완료 후 PR
- [07-Agent Communication](../07-agent-communication/spec.md) - Agent 간 통신
- [08-Job Scheduler](../08-job-scheduler/spec.md) - Job 스케줄링
