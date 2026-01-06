# Semo Office - Technical Plan

> 전체 시스템 아키텍처 및 기술 설계

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interface                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    office-web (Next.js + PixiJS)                     │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │   │
│  │  │  Office View  │  │  Job List     │  │  Chat Log     │            │   │
│  │  │  (PixiJS 2D)  │  │  (Progress)   │  │  (Messages)   │            │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │   │
│  │                              │                                       │   │
│  │                    ┌─────────┴─────────┐                            │   │
│  │                    │   Zustand Store   │                            │   │
│  │                    └─────────┬─────────┘                            │   │
│  └──────────────────────────────│──────────────────────────────────────┘   │
└──────────────────────────────────│──────────────────────────────────────────┘
                                   │ REST API + Realtime
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Backend Services                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    office-server (Express)                           │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │   │
│  │  │ Task          │  │ Job           │  │ Session       │            │   │
│  │  │ Decomposer    │──│ Scheduler     │──│ Executor      │            │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │   │
│  │         │                   │                   │                    │   │
│  │         │           ┌───────┴───────┐           │                    │   │
│  │         │           │ Worktree      │           │                    │   │
│  │         │           │ Manager       │           │                    │   │
│  │         │           └───────────────┘           │                    │   │
│  └─────────│───────────────────────────────────────│────────────────────┘   │
└─────────────│───────────────────────────────────────│────────────────────────┘
              │                                       │
              ▼                                       ▼
┌──────────────────────────┐            ┌──────────────────────────┐
│     Supabase (DB)        │            │   semo-remote-client     │
│  ┌────────────────────┐  │            │  ┌────────────────────┐  │
│  │ offices            │  │            │  │ Office Subscriber  │  │
│  │ agent_personas     │  │◄──────────►│  │                    │  │
│  │ worktrees          │  │  Realtime  │  │ ┌────────────────┐ │  │
│  │ office_agents      │  │            │  │ │ iTerm2 Python  │ │  │
│  │ job_queue          │  │            │  │ │ API Controller │ │  │
│  │ agent_messages     │  │            │  │ └────────────────┘ │  │
│  │ agent_commands     │  │            │  └────────────────────┘  │
│  │ agent_sessions     │  │            │            │              │
│  └────────────────────┘  │            │            ▼              │
└──────────────────────────┘            │  ┌────────────────────┐  │
                                        │  │  Claude Code       │  │
                                        │  │  Sessions          │  │
                                        │  │  (iTerm2 Tabs)     │  │
                                        │  └────────────────────┘  │
                                        └──────────────────────────┘
```

### Data Flow

```
[User] "로그인 기능 구현해줘"
    │
    ▼
[office-web] POST /api/offices/:id/tasks
    │
    ▼
[Task Decomposer]
    ├── 프로젝트 컨텍스트 분석
    ├── 역할별 Job 생성 (FE, BE, QA)
    ├── 의존성 그래프 생성
    └── Persona 매칭
    │
    ▼
[Job Scheduler]
    ├── 의존성 없는 Job → ready 상태
    ├── 의존성 있는 Job → pending 상태
    └── job_queue INSERT
    │
    ▼
[Session Executor] agent_commands INSERT
    │
    ▼
[semo-remote-client] Realtime 수신
    ├── Worktree 생성
    ├── Claude Code 세션 시작
    └── 초기 프롬프트 전송
    │
    ▼
[Claude Code] 작업 수행
    ├── 코드 작성
    ├── 테스트 실행
    └── PR 생성
    │
    ▼
[semo-remote-client] 결과 감지
    └── agent_command_results INSERT
    │
    ▼
[Session Executor] Realtime 수신
    ├── Job 상태 업데이트 → done
    └── 의존 Job → ready 전환
    │
    ▼
[office-web] Realtime 수신
    └── UI 업데이트 (Agent 상태, 진행률)
```

---

## DDD Layer Mapping

### Layer 0: CONFIG

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| 환경 설정 | `packages/office-server/.env` | Supabase, GitHub 설정 |
| | `packages/office-web/.env` | API URL, Supabase |
| DB 스키마 | `semo-system/semo-remote/db/migrations/` | 테이블 정의 |
| Persona 시드 | `004_office_tables.sql` | 기본 Persona 데이터 |

### Layer 1: DATA

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| DB Types | `packages/office-server/src/types.ts` | TypeScript 인터페이스 |
| API Types | `packages/office-web/src/lib/types.ts` | 프론트엔드 타입 |
| Supabase Tables | Supabase | offices, agents, jobs 등 |

### Layer 2: INFRA

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| Supabase Client | `packages/office-server/src/db/` | DB 연결 |
| Git Operations | `packages/office-server/src/worktree/` | simple-git 래퍼 |
| Realtime | `packages/office-server/src/realtime/` | Broadcast, Presence |
| Session Control | `semo-remote-client/src/main/` | iTerm2 API |

### Layer 3: APPLICATION

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| Task Decomposer | `packages/office-server/src/decomposer/` | 작업 분해 로직 |
| Job Scheduler | `packages/office-server/src/scheduler/` | 의존성 스케줄링 |
| Session Executor | `packages/office-server/src/session/` | 세션 명령 전송 |
| Worktree Manager | `packages/office-server/src/worktree/` | Git worktree 관리 |

### Layer 4: PRESENTATION

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| REST API | `packages/office-server/src/api/` | Express 라우트 |
| Office UI | `packages/office-web/src/components/office/` | PixiJS 컴포넌트 |
| Dashboard | `packages/office-web/src/app/` | Next.js 페이지 |

---

## Package Structure

### packages/office-server

```
office-server/
├── src/
│   ├── api/
│   │   ├── index.ts              # Express app 생성
│   │   ├── routes/
│   │   │   ├── offices.ts        # /api/offices
│   │   │   ├── tasks.ts          # /api/offices/:id/tasks
│   │   │   ├── jobs.ts           # /api/offices/:id/jobs
│   │   │   ├── agents.ts         # /api/offices/:id/agents
│   │   │   └── personas.ts       # /api/personas
│   │   └── middleware/
│   │       ├── errorHandler.ts
│   │       └── validation.ts
│   │
│   ├── decomposer/
│   │   ├── index.ts              # TaskDecomposer 클래스
│   │   ├── analyzer.ts           # 프로젝트 컨텍스트 분석
│   │   ├── jobGenerator.ts       # Job 생성 로직
│   │   └── personaMatcher.ts     # Persona 매칭
│   │
│   ├── scheduler/
│   │   ├── index.ts              # JobScheduler 클래스
│   │   ├── dependencyGraph.ts    # DAG 관리
│   │   └── priorityQueue.ts      # 우선순위 큐
│   │
│   ├── session/
│   │   ├── pool.ts               # SessionPool 클래스
│   │   ├── executor.ts           # SessionExecutor (명령 전송)
│   │   └── monitor.ts            # 상태 모니터링
│   │
│   ├── worktree/
│   │   ├── manager.ts            # WorktreeManager 클래스
│   │   ├── gitOperations.ts      # simple-git 래퍼
│   │   └── branchNaming.ts       # 브랜치 명명 규칙
│   │
│   ├── realtime/
│   │   ├── broadcast.ts          # RealtimeHandler
│   │   └── presence.ts           # Agent Presence
│   │
│   ├── db/
│   │   └── supabase.ts           # Supabase 클라이언트
│   │
│   ├── types.ts                  # 공통 타입
│   └── index.ts                  # 진입점
│
├── package.json
└── tsconfig.json
```

### packages/office-web

```
office-web/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 홈 (Office 목록)
│   │   ├── office/
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Office 메인 뷰
│   │   │       ├── settings/
│   │   │       │   └── page.tsx  # Office 설정
│   │   │       └── personas/
│   │   │           └── page.tsx  # Persona 관리
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── office/
│   │   │   ├── OfficeStage.tsx   # PixiJS 컨테이너
│   │   │   ├── OfficeBackground.tsx
│   │   │   ├── AgentSprite.tsx   # Agent 아바타
│   │   │   ├── FurnitureLayer.tsx
│   │   │   └── MessageBubble.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── OfficeCard.tsx
│   │   │   ├── JobList.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ChatLog.tsx
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   │
│   ├── stores/
│   │   ├── officeStore.ts        # Office 상태
│   │   ├── agentStore.ts         # Agent 상태
│   │   ├── jobStore.ts           # Job 상태
│   │   └── messageStore.ts       # 메시지 상태
│   │
│   ├── hooks/
│   │   ├── useRealtimeAgents.ts  # Agent Realtime 구독
│   │   ├── useRealtimeJobs.ts    # Job Realtime 구독
│   │   ├── useRealtimeMessages.ts
│   │   └── useOfficeApi.ts       # API 호출 훅
│   │
│   ├── lib/
│   │   ├── api.ts                # API 클라이언트
│   │   ├── supabase.ts           # Supabase 클라이언트
│   │   ├── types.ts              # 타입 정의
│   │   └── utils.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   └── sprites/                  # Agent 스프라이트
│
├── package.json
└── next.config.js
```

### semo-system/semo-office

```
semo-office/
├── skills/
│   ├── create-worktree/
│   │   └── SKILL.md
│   ├── remove-worktree/
│   │   └── SKILL.md
│   ├── create-pr/
│   │   └── SKILL.md
│   ├── merge-pr/
│   │   └── SKILL.md
│   └── sync-branch/
│       └── SKILL.md
│
├── agents/
│   └── task-decomposer/
│       └── AGENT.md
│
├── CLAUDE.md
├── VERSION
└── CHANGELOG/
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   offices   │       │ agent_personas  │       │  worktrees  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)         │       │ id (PK)     │
│ name        │       │ role            │       │ office_id   │──┐
│ github_org  │       │ name            │       │ agent_role  │  │
│ github_repo │       │ persona_prompt  │       │ path        │  │
│ repo_path   │       │ scope_patterns  │       │ branch      │  │
│ layout      │       │ core_skills     │       │ status      │  │
└─────────────┘       └─────────────────┘       └─────────────┘  │
       │                      │                        │         │
       │              ┌───────┴───────┐                │         │
       │              │               │                │         │
       ▼              ▼               │                │         │
┌─────────────────────────────────┐   │                │         │
│        office_agents            │   │                │         │
├─────────────────────────────────┤   │                │         │
│ id (PK)                         │   │                │         │
│ office_id (FK) ─────────────────┼───┼────────────────┼─────────┘
│ persona_id (FK) ────────────────┘   │                │
│ worktree_id (FK) ───────────────────┼────────────────┘
│ session_id                      │   │
│ status                          │   │
│ position_x, position_y          │   │
│ current_task                    │   │
│ last_message                    │   │
└─────────────────────────────────┘   │
       │                              │
       ▼                              │
┌─────────────────────────────────┐   │
│          job_queue              │   │
├─────────────────────────────────┤   │
│ id (PK)                         │   │
│ office_id (FK)                  │   │
│ agent_id (FK)                   │   │
│ worktree_id (FK)                │   │
│ description                     │   │
│ status                          │   │
│ depends_on[]                    │   │
│ pr_number                       │   │
│ branch_name                     │   │
│ priority                        │   │
└─────────────────────────────────┘   │
       │                              │
       ▼                              │
┌─────────────────────────────────┐   │
│       agent_messages            │   │
├─────────────────────────────────┤   │
│ id (PK)                         │   │
│ office_id (FK)                  │   │
│ from_agent_id (FK)              │   │
│ to_agent_id (FK)                │   │
│ message_type                    │   │
│ content                         │   │
│ context                         │   │
└─────────────────────────────────┘   │
                                      │
┌─────────────────────────────────┐   │
│       agent_commands            │◄──┘ (Phase 2)
├─────────────────────────────────┤
│ id (PK)                         │
│ office_id (FK)                  │
│ agent_id (FK)                   │
│ job_id (FK)                     │
│ iterm_session_id                │
│ command_type                    │
│ payload                         │
│ status                          │
│ timeout_seconds                 │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│    agent_command_results        │
├─────────────────────────────────┤
│ id (PK)                         │
│ command_id (FK)                 │
│ success                         │
│ output                          │
│ pr_number                       │
│ metadata                        │
└─────────────────────────────────┘
```

---

## Key Components

### 1. Task Decomposer

```typescript
class TaskDecomposer {
  // 사용자 요청을 분석하여 Job으로 분해
  async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
    // 1. 프로젝트 컨텍스트 분석
    const context = await this.analyzeContext(request.officeId);

    // 2. 역할별 Job 생성
    const jobs = await this.generateJobs(request.task, context);

    // 3. 의존성 그래프 생성
    const graph = this.buildDependencyGraph(jobs);

    // 4. Persona 매칭
    const matched = await this.matchPersonas(jobs);

    return { jobs: matched, graph, context };
  }
}
```

### 2. Job Scheduler

```typescript
class JobScheduler {
  // 의존성 기반 Job 스케줄링
  async scheduleJobs(jobs: Job[]): Promise<void> {
    for (const job of jobs) {
      if (this.hasNoDependencies(job)) {
        await this.markReady(job);
      } else {
        await this.markPending(job);
      }
    }
  }

  // Job 완료 시 의존 Job 활성화
  async onJobComplete(jobId: string): Promise<void> {
    const dependents = await this.findDependentJobs(jobId);
    for (const job of dependents) {
      if (await this.allDependenciesComplete(job)) {
        await this.markReady(job);
      }
    }
  }
}
```

### 3. Session Executor

```typescript
class SessionExecutor {
  // Agent 세션 생성 명령 전송
  async createSession(context: ExecutionContext): Promise<ExecutionResult> {
    const command = {
      office_id: context.officeId,
      agent_id: context.agentId,
      job_id: context.job.id,
      command_type: 'create_session',
      payload: {
        worktree_path: context.worktreePath,
        persona_name: context.persona.name,
        initial_prompt: this.buildPrompt(context),
      },
    };

    // agent_commands INSERT (semo-remote-client가 수신)
    await this.supabase.from('agent_commands').insert(command);

    // 결과 대기
    return this.waitForResult(command.id);
  }
}
```

### 4. Worktree Manager

```typescript
class WorktreeManager {
  // Agent용 Worktree 생성
  async createWorktree(officeId: string, agentRole: string): Promise<Worktree> {
    const branchName = `feature/${agentRole}-${Date.now()}`;
    const worktreePath = `/workspace/agent/${agentRole}`;

    // Git worktree add
    await this.git.worktree.add(worktreePath, branchName, { track: true });

    // DB 등록
    return this.supabase.from('worktrees').insert({
      office_id: officeId,
      agent_role: agentRole,
      path: worktreePath,
      branch: branchName,
    });
  }
}
```

---

## Frontend Architecture

### PixiJS Office Rendering

```tsx
// OfficeStage.tsx
<Stage width={1280} height={720}>
  {/* 배경 레이어 */}
  <OfficeBackground tiles={officeTiles} />

  {/* 가구 레이어 */}
  <FurnitureLayer furniture={furniture} />

  {/* Agent 레이어 */}
  <Container>
    {agents.map(agent => (
      <AgentSprite
        key={agent.id}
        agent={agent}
        position={agent.position}
        status={agent.status}
        onSelect={handleAgentSelect}
      />
    ))}
  </Container>

  {/* 말풍선 레이어 */}
  <MessageBubbleLayer messages={recentMessages} />
</Stage>
```

### Zustand Store

```typescript
// stores/officeStore.ts
interface OfficeState {
  currentOffice: Office | null;
  agents: Agent[];
  jobs: Job[];
  messages: Message[];

  // Actions
  setOffice: (office: Office) => void;
  updateAgent: (agent: Partial<Agent>) => void;
  addJob: (job: Job) => void;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  addMessage: (message: Message) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  currentOffice: null,
  agents: [],
  jobs: [],
  messages: [],

  setOffice: (office) => set({ currentOffice: office }),
  updateAgent: (update) => set((state) => ({
    agents: state.agents.map(a =>
      a.id === update.id ? { ...a, ...update } : a
    ),
  })),
  // ...
}));
```

### Realtime Hooks

```typescript
// hooks/useRealtimeAgents.ts
export function useRealtimeAgents(officeId: string) {
  const updateAgent = useOfficeStore(state => state.updateAgent);

  useEffect(() => {
    const channel = supabase
      .channel(`office:${officeId}:agents`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'office_agents',
        filter: `office_id=eq.${officeId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          updateAgent(payload.new as Agent);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [officeId]);
}
```

---

## API Design

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Offices** |
| GET | `/api/offices` | 오피스 목록 |
| POST | `/api/offices` | 오피스 생성 |
| GET | `/api/offices/:id` | 오피스 조회 |
| DELETE | `/api/offices/:id` | 오피스 삭제 |
| **Tasks** |
| POST | `/api/offices/:id/tasks` | 작업 요청 (자연어) |
| **Jobs** |
| GET | `/api/offices/:id/jobs` | Job 목록 |
| GET | `/api/offices/:id/jobs/:jobId` | Job 상세 |
| PATCH | `/api/offices/:id/jobs/:jobId` | Job 상태 업데이트 |
| **Agents** |
| GET | `/api/offices/:id/agents` | Agent 목록 |
| POST | `/api/offices/:id/agents` | Agent 생성 |
| PATCH | `/api/offices/:id/agents/:agentId` | Agent 업데이트 |
| POST | `/api/offices/:id/agents/:agentId/message` | Agent에 메시지 |
| **Personas** |
| GET | `/api/personas` | Persona 목록 |
| POST | `/api/personas` | 커스텀 Persona 생성 |
| PUT | `/api/personas/:id` | Persona 수정 |

---

## Risk Mitigation

### Git Worktree 디스크 사용량

- **문제**: Agent당 전체 레포 복사 → 디스크 부족
- **완화**:
  - 얕은 클론 (`--depth 1`)
  - 작업 완료 후 자동 정리
  - Sparse checkout (필요한 디렉토리만)

### Claude Code 세션 불안정

- **문제**: 장시간 작업 중 세션 끊김
- **완화**:
  - 세션 상태 모니터링
  - 자동 재연결 로직
  - 작업 체크포인트 저장

### 복잡한 의존성 그래프

- **문제**: 순환 의존성, 데드락
- **완화**:
  - DAG 사이클 감지
  - 의존성 깊이 제한
  - 수동 개입 옵션

---

## Testing Strategy

### Unit Tests

- Task Decomposer 로직
- Job Scheduler 의존성 계산
- Worktree Manager Git 작업

### Integration Tests

- API 엔드포인트
- Supabase Realtime 연동
- semo-remote-client 명령 전송

### E2E Tests

- 전체 워크플로우: 요청 → 분해 → 실행 → 완료
- UI 상호작용: Office 뷰, Agent 상태

---

## Performance Considerations

| 항목 | 목표 | 최적화 방안 |
|------|------|-------------|
| 작업 분해 | < 3초 | 캐싱, 병렬 분석 |
| Worktree 생성 | < 5초 | 얕은 클론, sparse checkout |
| UI 렌더링 | > 30 FPS | PixiJS 최적화, 스프라이트 시트 |
| Realtime 지연 | < 1초 | Supabase 인프라 |
| DB 쿼리 | < 100ms | 인덱스, 쿼리 최적화 |
