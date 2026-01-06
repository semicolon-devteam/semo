# 06-Realtime UI: Implementation Tasks

---

## Task Summary

| Layer | Tasks | Version |
|-------|-------|---------|
| CONFIG | 1 | v0.1.0 |
| INFRA | 2 | v0.1.2 |
| APPLICATION | 3 | v0.1.3 |
| PRESENTATION | 6 | v0.1.4 |
| **Total** | **12** | |

---

## Layer 0: CONFIG

### TASK-UI01: 프로젝트 설정

**파일**: `packages/office-web/package.json`, `tsconfig.json`

**작업 내용**:
- [ ] Next.js 14 프로젝트 생성
- [ ] 의존성 설치: PixiJS, @pixi/react, Zustand, @supabase/supabase-js
- [ ] Tailwind CSS 설정
- [ ] TypeScript 설정
- [ ] ESLint/Prettier 설정

**의존성**:
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "pixi.js": "^7.3.0",
    "@pixi/react": "^7.1.0",
    "zustand": "^4.4.0",
    "@supabase/supabase-js": "^2.38.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

---

## Layer 2: INFRA

### TASK-UI02: Supabase Client

**파일**: `packages/office-web/src/lib/supabase.ts`

**작업 내용**:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 타입 정의
export type Database = {
  public: {
    Tables: {
      offices: OfficeTable;
      office_agents: OfficeAgentTable;
      job_queue: JobTable;
      agent_messages: MessageTable;
    };
  };
};
```

---

### TASK-UI03: API Client

**파일**: `packages/office-web/src/lib/api.ts`

**작업 내용**:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  // Offices
  getOffices: () => fetch(`${API_BASE}/api/offices`).then(r => r.json()),
  getOffice: (id: string) => fetch(`${API_BASE}/api/offices/${id}`).then(r => r.json()),

  // Agents
  getAgents: (officeId: string) =>
    fetch(`${API_BASE}/api/offices/${officeId}/agents`).then(r => r.json()),

  // Jobs
  getJobs: (officeId: string) =>
    fetch(`${API_BASE}/api/offices/${officeId}/jobs`).then(r => r.json()),

  // Tasks
  submitTask: (officeId: string, task: string) =>
    fetch(`${API_BASE}/api/offices/${officeId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    }).then(r => r.json()),

  // Messages
  getMessages: (officeId: string) =>
    fetch(`${API_BASE}/api/offices/${officeId}/messages`).then(r => r.json()),
};
```

---

## Layer 3: APPLICATION

### TASK-UI04: Office Store

**파일**: `packages/office-web/src/stores/officeStore.ts`

**작업 내용**:
```typescript
import { create } from 'zustand';

interface OfficeStore {
  // 상태
  currentOffice: Office | null;
  agents: OfficeAgent[];
  jobs: Job[];
  messages: AgentMessage[];

  // 액션
  setOffice: (office: Office) => void;
  setAgents: (agents: OfficeAgent[]) => void;
  updateAgent: (agentId: string, updates: Partial<OfficeAgent>) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  addJob: (job: Job) => void;
  addMessage: (message: AgentMessage) => void;
  setMessages: (messages: AgentMessage[]) => void;
}

export const useOfficeStore = create<OfficeStore>((set) => ({
  currentOffice: null,
  agents: [],
  jobs: [],
  messages: [],

  setOffice: (office) => set({ currentOffice: office }),
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, ...updates } : a
      ),
    })),
  // ... 나머지 액션
}));
```

---

### TASK-UI05: View Store

**파일**: `packages/office-web/src/stores/viewStore.ts`

**작업 내용**:
```typescript
interface ViewStore {
  // 상태
  zoom: number;
  pan: { x: number; y: number };
  selectedAgentId: string | null;
  hoveredAgentId: string | null;
  showJobPanel: boolean;
  showMessageLog: boolean;

  // 액션
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  selectAgent: (agentId: string | null) => void;
  hoverAgent: (agentId: string | null) => void;
  toggleJobPanel: () => void;
  toggleMessageLog: () => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedAgentId: null,
  hoveredAgentId: null,
  showJobPanel: true,
  showMessageLog: true,
  // ... 액션
}));
```

---

### TASK-UI06: Realtime Hooks

**파일**: `packages/office-web/src/hooks/useRealtime.ts`

**작업 내용**:
```typescript
export function useRealtimeSubscription(officeId: string) {
  const { updateAgent, addJob, updateJob, addMessage } = useOfficeStore();

  useEffect(() => {
    // Presence
    const presence = supabase.channel(`office:${officeId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState();
        // Agent 온라인 상태 업데이트
      })
      .subscribe();

    // Broadcast
    const broadcast = supabase.channel(`office:${officeId}:broadcast`)
      .on('broadcast', { event: 'agent_message' }, (payload) => {
        addMessage(payload.payload);
      })
      .on('broadcast', { event: 'agent_status' }, (payload) => {
        updateAgent(payload.payload.agent_id, payload.payload);
      })
      .subscribe();

    // Postgres Changes
    const dbChanges = supabase.channel(`office:${officeId}:db`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'office_agents',
        filter: `office_id=eq.${officeId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          updateAgent(payload.new.id, payload.new);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_queue',
        filter: `office_id=eq.${officeId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          addJob(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          updateJob(payload.new.id, payload.new);
        }
      })
      .subscribe();

    return () => {
      presence.unsubscribe();
      broadcast.unsubscribe();
      dbChanges.unsubscribe();
    };
  }, [officeId]);
}
```

---

## Layer 4: PRESENTATION

### TASK-UI07: Office Canvas (PixiJS)

**파일**: `packages/office-web/src/components/office/OfficeCanvas.tsx`

**작업 내용**:
```typescript
import { Stage, Container, Sprite } from '@pixi/react';
import { useOfficeStore } from '@/stores/officeStore';
import { useViewStore } from '@/stores/viewStore';

export function OfficeCanvas() {
  const { agents, currentOffice } = useOfficeStore();
  const { zoom, pan, selectAgent } = useViewStore();

  return (
    <Stage
      width={800}
      height={600}
      options={{ backgroundColor: 0xf0f0f0 }}
    >
      <Container scale={zoom} x={pan.x} y={pan.y}>
        {/* 배경 */}
        <OfficeBackground layout={currentOffice?.layout} />

        {/* 가구 */}
        <FurnitureLayer furniture={currentOffice?.layout?.furniture} />

        {/* Agent 아바타 */}
        <AgentLayer agents={agents} onSelect={selectAgent} />

        {/* 말풍선 */}
        <MessageBubbleLayer agents={agents} />
      </Container>
    </Stage>
  );
}
```

---

### TASK-UI08: Agent Avatar Component

**파일**: `packages/office-web/src/components/office/AgentAvatar.tsx`

**작업 내용**:
```typescript
import { Sprite, Container, Text } from '@pixi/react';
import { useCallback } from 'react';

interface AgentAvatarProps {
  agent: OfficeAgent;
  onSelect: (id: string) => void;
}

export function AgentAvatar({ agent, onSelect }: AgentAvatarProps) {
  const handleClick = useCallback(() => {
    onSelect(agent.id);
  }, [agent.id, onSelect]);

  // 상태별 색상/효과
  const tint = getStatusTint(agent.status);
  const alpha = agent.status === 'idle' ? 0.8 : 1;

  return (
    <Container x={agent.position_x} y={agent.position_y}>
      {/* 아바타 스프라이트 */}
      <Sprite
        image={`/sprites/agent-${agent.persona.role.toLowerCase()}.png`}
        anchor={0.5}
        tint={tint}
        alpha={alpha}
        interactive
        pointerdown={handleClick}
      />

      {/* 이름 라벨 */}
      <Text
        text={agent.persona.name}
        y={30}
        anchor={0.5}
        style={{ fontSize: 12, fill: 0x333333 }}
      />

      {/* 상태 인디케이터 */}
      <StatusIndicator status={agent.status} />
    </Container>
  );
}

function getStatusTint(status: string): number {
  switch (status) {
    case 'working': return 0x4CAF50;  // 녹색
    case 'blocked': return 0xFF9800;  // 주황
    case 'error': return 0xF44336;    // 빨강
    default: return 0xFFFFFF;         // 기본
  }
}
```

---

### TASK-UI09: Job List Panel

**파일**: `packages/office-web/src/components/panels/JobList.tsx`

**작업 내용**:
```typescript
import { useOfficeStore } from '@/stores/officeStore';

export function JobList() {
  const { jobs } = useOfficeStore();

  // 상태별 그룹화
  const grouped = groupJobsByStatus(jobs);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">진행 상황</h3>

      {/* 진행 중 */}
      <JobGroup title="진행 중" jobs={grouped.processing} />

      {/* 대기 중 */}
      <JobGroup title="대기 중" jobs={grouped.pending} />

      {/* 완료 */}
      <JobGroup title="완료" jobs={grouped.done} collapsed />
    </div>
  );
}

function JobItem({ job }: { job: Job }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b">
      <StatusBadge status={job.status} />
      <span className="flex-1 truncate">{job.description}</span>
      {job.pr_number && (
        <a href={`#pr-${job.pr_number}`} className="text-blue-500">
          PR #{job.pr_number}
        </a>
      )}
      <ProgressBar progress={job.progress || 0} />
    </div>
  );
}
```

---

### TASK-UI10: Message Log Panel

**파일**: `packages/office-web/src/components/panels/MessageLog.tsx`

**작업 내용**:
```typescript
import { useOfficeStore } from '@/stores/officeStore';
import { useRef, useEffect } from 'react';

export function MessageLog() {
  const { messages } = useOfficeStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-64 bg-white rounded-lg shadow">
      <h3 className="p-2 font-semibold border-b">대화 로그</h3>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: AgentMessage }) {
  const isSystem = message.message_type === 'system';

  return (
    <div className={`py-1 ${isSystem ? 'text-gray-500 italic' : ''}`}>
      {!isSystem && (
        <span className="font-medium text-blue-600">
          {message.from_agent?.persona?.name}
          {message.to_agent && ` → ${message.to_agent.persona?.name}`}:
        </span>
      )}
      <span className="ml-1">{message.content}</span>
      <span className="ml-2 text-xs text-gray-400">
        {formatTime(message.created_at)}
      </span>
    </div>
  );
}
```

---

### TASK-UI11: Command Input

**파일**: `packages/office-web/src/components/CommandInput.tsx`

**작업 내용**:
```typescript
import { useState } from 'react';
import { api } from '@/lib/api';

interface CommandInputProps {
  officeId: string;
}

export function CommandInput({ officeId }: CommandInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const result = await api.submitTask(officeId, input);
      // 성공 피드백
      setInput('');
    } catch (error) {
      // 에러 처리
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-gray-100">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="작업을 입력하세요 (예: 로그인 기능 구현해줘)"
        className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? '처리 중...' : '전송'}
      </button>
    </form>
  );
}
```

---

### TASK-UI12: Office Page

**파일**: `packages/office-web/src/app/office/[id]/page.tsx`

**작업 내용**:
```typescript
'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOfficeStore } from '@/stores/officeStore';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { OfficeCanvas } from '@/components/office/OfficeCanvas';
import { JobList } from '@/components/panels/JobList';
import { MessageLog } from '@/components/panels/MessageLog';
import { CommandInput } from '@/components/CommandInput';

export default function OfficePage({ params }: { params: { id: string } }) {
  const { setOffice, setAgents, setJobs, setMessages } = useOfficeStore();

  // 초기 데이터 로드
  const { data: office } = useQuery(['office', params.id], () =>
    api.getOffice(params.id)
  );
  const { data: agents } = useQuery(['agents', params.id], () =>
    api.getAgents(params.id)
  );
  const { data: jobs } = useQuery(['jobs', params.id], () =>
    api.getJobs(params.id)
  );
  const { data: messages } = useQuery(['messages', params.id], () =>
    api.getMessages(params.id)
  );

  // Store 동기화
  useEffect(() => {
    if (office) setOffice(office);
    if (agents) setAgents(agents);
    if (jobs) setJobs(jobs);
    if (messages) setMessages(messages);
  }, [office, agents, jobs, messages]);

  // Realtime 구독
  useRealtimeSubscription(params.id);

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">{office?.name || 'Loading...'}</h1>
        <div className="flex gap-2">
          <span className="text-gray-500">
            {office?.github_org}/{office?.github_repo}
          </span>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 오피스 캔버스 */}
        <div className="flex-1">
          <OfficeCanvas />
        </div>

        {/* 사이드 패널 */}
        <div className="w-80 p-4 bg-gray-50 overflow-y-auto">
          <JobList />
          <div className="mt-4">
            <MessageLog />
          </div>
        </div>
      </div>

      {/* 명령 입력 */}
      <CommandInput officeId={params.id} />
    </div>
  );
}
```

---

## Completion Checklist

- [ ] Next.js 프로젝트 설정 완료
- [ ] Supabase Client 동작
- [ ] API Client 동작
- [ ] Office Store 동작
- [ ] View Store 동작
- [ ] Realtime Hooks 동작
- [ ] Office Canvas (PixiJS) 렌더링
- [ ] Agent Avatar 표시 및 상태 반영
- [ ] Job List Panel 동작
- [ ] Message Log Panel 동작
- [ ] Command Input 동작
- [ ] Office Page 통합 완료
- [ ] E2E: 오피스 접속 → Agent 표시 → 작업 요청 → 실시간 상태 업데이트
