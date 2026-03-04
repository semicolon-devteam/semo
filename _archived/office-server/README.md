# @team-semicolon/semo-office-server

> Semo Office Server - Multi-agent orchestration backend

## Overview

Semo Office Server는 멀티에이전트 협업 시스템의 백엔드 서버입니다.
사용자 요청을 분해하고, Agent를 스케줄링하며, Git Worktree를 관리합니다.

## Features

- **Task Decomposer**: 자연어 요청을 역할별 Job으로 분해
- **Session Pool**: Claude Code 세션 관리 (Warm/Cold Pool)
- **Worktree Manager**: Git Worktree 생성/삭제/동기화
- **Job Scheduler**: 의존성 기반 Job 스케줄링
- **Realtime Handler**: Supabase Realtime을 통한 상태 동기화

## Installation

```bash
npm install @team-semicolon/semo-office-server
```

## Usage

### API Server

```typescript
import { createApp } from '@team-semicolon/semo-office-server';

const app = createApp();
app.listen(3001, () => {
  console.log('Semo Office Server running on port 3001');
});
```

### Task Decomposer

```typescript
import { TaskDecomposer } from '@team-semicolon/semo-office-server';

const decomposer = new TaskDecomposer();

const result = await decomposer.decompose({
  office_id: 'office-123',
  request: '로그인 기능 구현해줘',
  context: {
    repo: 'my-org/my-project',
    tech_stack: ['Next.js', 'NestJS'],
  },
});

console.log(result.jobs);
// [
//   { role: 'FE', description: 'Login UI implementation', ... },
//   { role: 'BE', description: 'Auth API implementation', ... },
//   { role: 'QA', description: 'Login flow testing', ... },
// ]
```

### Worktree Manager

```typescript
import { WorktreeManager } from '@team-semicolon/semo-office-server';

const manager = new WorktreeManager();

// Create worktree for FE agent
const worktree = await manager.createWorktree({
  officeId: 'office-123',
  repoPath: '/path/to/repo',
  agentRole: 'FE',
});

// Sync with main
await manager.syncWorktree(worktree.path, 'main', 'rebase');

// Remove when done
await manager.removeWorktree({ worktreePath: worktree.path });
```

### Session Pool

```typescript
import { SessionPool } from '@team-semicolon/semo-office-server';

const pool = new SessionPool({
  warmPoolSize: 4,
  maxColdSessions: 10,
});

await pool.initialize();

// Acquire session for agent
const session = await pool.acquire('FE', '/path/to/worktree');

// Release when done
await pool.release(session.id);
```

## API Endpoints

### Offices

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices` | 오피스 생성 |
| GET | `/api/offices/:id` | 오피스 조회 |
| DELETE | `/api/offices/:id` | 오피스 삭제 |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/tasks` | 작업 요청 (자연어) |
| GET | `/api/offices/:id/jobs` | Job 목록 조회 |
| GET | `/api/offices/:id/jobs/:jobId` | Job 상세 조회 |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/agents` | Agent 상태 조회 |
| POST | `/api/offices/:id/agents/:role/message` | Agent에 메시지 전송 |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | 페르소나 목록 |
| POST | `/api/personas` | 커스텀 페르소나 생성 |
| PUT | `/api/personas/:id` | 페르소나 수정 |

### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/skills` | 오피스 스킬 목록 |
| POST | `/api/offices/:id/skills` | 커스텀 스킬 추가 |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `SUPABASE_URL` | Supabase project URL | - |
| `SUPABASE_ANON_KEY` | Supabase anon key | - |

## Related

- [@team-semicolon/semo-office-web](../office-web/) - Frontend UI
- [semo-office](../../semo-system/semo-office/) - Skills & Agents
