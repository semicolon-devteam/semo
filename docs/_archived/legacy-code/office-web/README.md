# @team-semicolon/semo-office-web

> Semo Office Web - GatherTown-style multi-agent collaboration UI

## Overview

Semo Office Web은 AI Agent들이 가상 오피스에서 협업하는 모습을 시각화하는 프론트엔드입니다.
GatherTown 스타일의 2D 픽셀 아트 인터페이스로 Agent 상태, 대화, 작업 진행률을 실시간으로 표시합니다.

## Features

- **2D Office View**: PixiJS 기반 가상 오피스 렌더링
- **Real-time Updates**: Supabase Realtime을 통한 Agent 상태 동기화
- **Agent Avatars**: 역할별 색상 구분 및 상태 표시
- **Message Bubbles**: Agent 간 대화 말풍선
- **Progress Tracking**: Job 진행률 시각화
- **Command Input**: 자연어 명령 입력

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 |
| Rendering | PixiJS + @pixi/react |
| State | Zustand |
| Realtime | Supabase |
| Styling | Tailwind CSS |

## Installation

```bash
npm install
npm run dev
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_OFFICE_SERVER_URL=http://localhost:3001
```

## Pages

| Path | Description |
|------|-------------|
| `/` | 오피스 목록 (대시보드) |
| `/office/[id]` | 오피스 뷰 (메인) |
| `/office/[id]/settings` | 오피스 설정 |
| `/office/new` | 새 오피스 생성 |

## Components

### Office Components

- `OfficeCanvas` - PixiJS 기반 오피스 렌더링
- `AgentAvatar` - Agent 아바타 컴포넌트
- `MessageBubble` - 말풍선 컴포넌트
- `FurnitureLayer` - 가구 렌더링

### UI Components

- `ProgressBar` - 작업 진행률 표시
- `ChatLog` - 메시지 로그
- `CommandInput` - 명령 입력창

## State Management

```typescript
// Zustand store
const { agents, jobs, messages } = useOfficeStore();

// Agent update
updateAgent(agentId, { status: 'working', x: 300, y: 200 });

// Add message
addMessage({ fromAgentId, content, timestamp });
```

## Realtime Integration

```typescript
// Hook for Supabase Realtime
useSupabaseRealtime(officeId);

// Subscriptions:
// - Presence: Agent positions and status
// - Broadcast: Agent messages
// - Postgres Changes: Job updates
```

## Agent Colors

| Role | Color |
|------|-------|
| PO | #fc5185 |
| FE | #e94560 |
| BE | #0f4c75 |
| QA | #3fc1c9 |
| DevOps | #364f6b |

## Related

- [@team-semicolon/semo-office-server](../office-server/) - Backend API
- [semo-office](../../semo-system/semo-office/) - Skills & Agents
