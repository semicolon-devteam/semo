# 06-Realtime UI: GatherTown 스타일 오피스 뷰

> 2D 도트 스타일 오피스, Agent 아바타, 실시간 상태 동기화

---

## Overview

Semo Office UI는 GatherTown 스타일의 2D 가상 오피스입니다.
각 Agent는 아바타로 표현되며, 작업 상태와 대화가 실시간으로 시각화됩니다.

### 화면 구성

```text
+----------------------------------------------------------------+
| [Semo Office]  레포: semicolon/service-a  v  | 알림 | 설정 |    |
+----------------------------------------------------------------+
|                                                                |
|   +--------------------------------------------------------+   |
|   |                  오피스 뷰 (PixiJS)                      |   |
|   |  +-----+                           +-----+              |   |
|   |  | PO  |  "Epic 분석 중..."        | PM  |              |   |
|   |  +-----+                           +-----+              |   |
|   |           +-----+      +-----+                          |   |
|   |           | FE  | ---> | BE  |  "API 연동 중"           |   |
|   |           +-----+      +-----+                          |   |
|   |                              +-----+                    |   |
|   |                              | QA  |  "테스트 대기"      |   |
|   |                              +-----+                    |   |
|   +--------------------------------------------------------+   |
|                                                                |
+----------------------------------------------------------------+
| [진행 상황]                                                     |
| - TASK-101: FE 컴포넌트 구현 [========  ] 80%  PR #42          |
| - TASK-102: BE API 구현      [==========] 100% PR #43 Merged   |
| - TASK-103: QA 테스트        [          ] 대기중               |
+----------------------------------------------------------------+
| [대화 로그]                                                     |
| BE -> FE: "API 완료! GET /api/users 확인해주세요"               |
| FE: "확인했습니다. 연동 시작합니다"                              |
+----------------------------------------------------------------+
| [명령 입력]                                                     |
| > "로그인 기능 구현해줘"                              [전송]    |
+----------------------------------------------------------------+
```

---

## User Stories

### US-UI01: 오피스 뷰

> "오피스에 배치된 Agent들을 2D 맵에서 볼 수 있다"

**AC**:
- PixiJS로 2D 타일맵 렌더링
- Agent 아바타 표시 (역할별 스프라이트)
- 가구/오브젝트 배치 (책상, 의자, 화이트보드)
- 줌/팬 지원

### US-UI02: Agent 상태 표시

> "각 Agent의 현재 상태를 시각적으로 확인할 수 있다"

**AC**:
- 상태별 아바타 색상/애니메이션
  - `idle`: 기본 (정지)
  - `working`: 작업 중 (펄스 효과)
  - `blocked`: 대기 (느린 깜빡임)
- 말풍선으로 현재 작업/메시지 표시
- 상태 변경 시 애니메이션

### US-UI03: 실시간 동기화

> "Agent 상태, Job 진행률, 메시지가 실시간으로 업데이트된다"

**AC**:
- Supabase Realtime 구독
- Presence로 Agent 온라인 상태
- Broadcast로 메시지 전송
- Postgres Changes로 DB 변경 감지

### US-UI04: 작업 진행 패널

> "현재 진행 중인 작업 목록과 진행률을 볼 수 있다"

**AC**:
- Job 목록 표시 (상태, 진행률, PR 정보)
- 의존성 시각화 (화살표/선)
- 필터링 (상태별, Agent별)

### US-UI05: 대화 로그

> "Agent 간 메시지와 시스템 이벤트를 확인할 수 있다"

**AC**:
- 시간순 메시지 로그
- Agent 간 메시지 (요청, 응답)
- 시스템 이벤트 (Job 시작, PR 생성, 머지)
- 스크롤, 검색, 필터

### US-UI06: 명령 입력

> "자연어로 작업을 요청할 수 있다"

**AC**:
- 텍스트 입력창
- 엔터/버튼으로 전송
- 전송 후 Task Decomposer 호출
- 결과 피드백 표시

---

## Tech Stack

| 레이어 | 기술 | 이유 |
|--------|------|------|
| **렌더링** | PixiJS + @pixi/react | 성능, React 통합 |
| **상태 관리** | Zustand | 단순함, 성능 |
| **실시간** | Supabase Realtime | 기존 인프라 |
| **프레임워크** | Next.js 14 | SSR, API Routes |
| **스타일** | Tailwind CSS | 유틸리티 퍼스트 |

---

## Data Models

### OfficeViewState

```typescript
interface OfficeViewState {
  office: Office;
  agents: OfficeAgent[];
  jobs: Job[];
  messages: AgentMessage[];
  layout: OfficeLayout;
  selectedAgentId?: string;
}
```

### OfficeLayout

```typescript
interface OfficeLayout {
  width: number;
  height: number;
  tileSize: number;
  background: string;  // 타일맵 이미지
  furniture: Furniture[];
  agentPositions: Map<string, Position>;
}

interface Furniture {
  type: 'desk' | 'chair' | 'whiteboard' | 'plant';
  position: Position;
  sprite: string;
}

interface Position {
  x: number;
  y: number;
}
```

### AgentAvatar

```typescript
interface AgentAvatar {
  role: string;
  name: string;
  sprite: string;       // 스프라이트 이미지
  color: string;        // 역할별 색상
  status: AgentStatus;
  position: Position;
  message?: string;     // 말풍선 내용
}
```

---

## Components

### PixiJS 컴포넌트 구조

```text
<OfficeStage>                    // PixiJS Stage
├── <OfficeBackground />         // 타일맵 배경
├── <FurnitureLayer>             // 가구 레이어
│   ├── <Desk />
│   ├── <Chair />
│   └── <Whiteboard />
├── <AgentLayer>                 // Agent 레이어
│   ├── <Agent role="PO" />
│   ├── <Agent role="FE" />
│   ├── <Agent role="BE" />
│   └── <Agent role="QA" />
├── <MessageBubbleLayer>         // 말풍선 레이어
│   └── <MessageBubble />
└── <SelectionOverlay />         // 선택 영역
</OfficeStage>
```

### React 컴포넌트 구조

```text
<OfficePage>
├── <Header>
│   ├── <OfficeSelector />
│   ├── <NotificationBell />
│   └── <SettingsMenu />
├── <MainContent>
│   ├── <OfficeCanvas />         // PixiJS 래퍼
│   └── <SidePanel>
│       ├── <JobList />
│       ├── <AgentDetails />
│       └── <MessageLog />
├── <TaskProgress />             // 하단 진행률 바
└── <CommandInput />             // 명령 입력창
```

---

## Zustand Stores

### officeStore

```typescript
interface OfficeStore {
  // 상태
  currentOffice: Office | null;
  agents: OfficeAgent[];
  jobs: Job[];
  messages: AgentMessage[];

  // 액션
  setOffice: (office: Office) => void;
  updateAgent: (agentId: string, updates: Partial<OfficeAgent>) => void;
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  addMessage: (message: AgentMessage) => void;
}
```

### viewStore

```typescript
interface ViewStore {
  // 상태
  zoom: number;
  pan: Position;
  selectedAgentId: string | null;
  hoveredAgentId: string | null;

  // 액션
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  selectAgent: (agentId: string | null) => void;
  hoverAgent: (agentId: string | null) => void;
}
```

---

## Supabase Realtime

### Presence (Agent 온라인 상태)

```typescript
const presence = supabase.channel(`office:${officeId}`)
  .on('presence', { event: 'sync' }, () => {
    const state = presence.presenceState();
    updateAgentOnlineStatus(state);
  })
  .on('presence', { event: 'join' }, ({ newPresences }) => {
    handleAgentJoin(newPresences);
  })
  .on('presence', { event: 'leave' }, ({ leftPresences }) => {
    handleAgentLeave(leftPresences);
  })
  .subscribe();
```

### Broadcast (메시지)

```typescript
const messages = supabase.channel(`office:${officeId}:messages`)
  .on('broadcast', { event: 'agent_message' }, (payload) => {
    addMessage(payload);
    showMessageBubble(payload.from, payload.content);
  })
  .on('broadcast', { event: 'system_event' }, (payload) => {
    addSystemEvent(payload);
  })
  .subscribe();
```

### Postgres Changes (DB 변경)

```typescript
const dbChanges = supabase.channel(`office:${officeId}:db`)
  // Agent 상태 변경
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'office_agents',
    filter: `office_id=eq.${officeId}`
  }, (payload) => {
    updateAgent(payload.new.id, payload.new);
  })
  // Job 상태 변경
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'job_queue',
    filter: `office_id=eq.${officeId}`
  }, (payload) => {
    handleJobChange(payload);
  })
  .subscribe();
```

---

## API Client

### useOfficeApi Hook

```typescript
function useOfficeApi(officeId: string) {
  // 쿼리
  const { data: office } = useQuery(['office', officeId], () =>
    fetch(`/api/offices/${officeId}`).then(r => r.json())
  );

  const { data: agents } = useQuery(['agents', officeId], () =>
    fetch(`/api/offices/${officeId}/agents`).then(r => r.json())
  );

  const { data: jobs } = useQuery(['jobs', officeId], () =>
    fetch(`/api/offices/${officeId}/jobs`).then(r => r.json())
  );

  // 뮤테이션
  const submitTask = useMutation((task: string) =>
    fetch(`/api/offices/${officeId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ task })
    })
  );

  return { office, agents, jobs, submitTask };
}
```

---

## Pages

### /office/[id]

메인 오피스 뷰 페이지

```typescript
export default function OfficePage({ params }: { params: { id: string } }) {
  const { office, agents, jobs } = useOfficeApi(params.id);
  useRealtimeSubscription(params.id);

  return (
    <div className="flex flex-col h-screen">
      <Header office={office} />
      <div className="flex flex-1">
        <OfficeCanvas agents={agents} />
        <SidePanel jobs={jobs} />
      </div>
      <TaskProgress jobs={jobs} />
      <CommandInput officeId={params.id} />
    </div>
  );
}
```

### /office/[id]/settings

오피스 설정 페이지

- 오피스 정보 수정
- 레이아웃 편집
- 페르소나 관리

### /office/[id]/history

작업 히스토리 페이지

- 완료된 Job 목록
- PR 히스토리
- 통계 대시보드

---

## Animation & Effects

### Agent 상태 애니메이션

| 상태 | 효과 |
|------|------|
| `idle` | 정지 (미세한 호흡 효과) |
| `working` | 펄스 효과 (밝아졌다 어두워짐) |
| `blocked` | 느린 깜빡임 |
| `error` | 빨간색 하이라이트 |

### 메시지 애니메이션

```typescript
// 말풍선 등장
const showBubble = (agentId: string, message: string) => {
  // 1. 페이드 인 + 위로 슬라이드
  // 2. 3초 후 페이드 아웃
  // 3. 제거
};

// Agent 간 메시지 전송 효과
const showMessagePath = (fromId: string, toId: string) => {
  // 1. 발신 Agent에서 수신 Agent로 점선 이동
  // 2. 도착 시 수신 Agent 하이라이트
};
```

---

## Related Specs

- [01-Core](../01-core/spec.md) - Office, Agent 데이터
- [04-Session Execution](../04-session-execution/spec.md) - 세션 상태
- [05-PR Workflow](../05-pr-workflow/spec.md) - PR 상태
