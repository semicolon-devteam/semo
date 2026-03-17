# Semo Office

> GatherTown 스타일 가상 오피스에서 AI Agent들이 협업하는 멀티에이전트 시스템

## Overview

Semo Office는 여러 AI Agent(PO, FE, BE, QA, DevOps)가 가상 오피스에서 협업하여 소프트웨어 개발 작업을 수행하는 시스템입니다.

### 핵심 기능

- **Task Decomposition**: 자연어 요청을 역할별 Job으로 자동 분해
- **Git Worktree Isolation**: Agent별 물리적 작업 공간 격리로 충돌 방지
- **PR-based Workflow**: 의존성 순서에 따른 자동 PR 생성 및 병합
- **Real-time Visualization**: GatherTown 스타일 2D 오피스 뷰

## Architecture

```
                      사용자 요청
                          │
                          ▼
                ┌───────────────────┐
                │  Task Decomposer  │ ← 작업을 역할별로 분해
                └─────────┬─────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  ┌───────────┐     ┌───────────┐     ┌───────────┐
  │ Worktree  │     │ Worktree  │     │ Worktree  │
  │ agent/fe  │     │ agent/be  │     │ agent/qa  │
  └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
        │                 │                 │
        ▼                 ▼                 ▼
  ┌───────────┐     ┌───────────┐     ┌───────────┐
  │  Agent FE │     │  Agent BE │     │  Agent QA │
  │ (Persona) │     │ (Persona) │     │ (Persona) │
  └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
                ┌───────────────────┐
                │   PR-based Merge  │ ← 의존성 순서로 병합
                └───────────────────┘
```

## Package Structure

```
semo/
├── packages/
│   ├── office-server/    # 백엔드 API 서버
│   │   ├── src/
│   │   │   ├── api/          # REST API 엔드포인트
│   │   │   ├── decomposer/   # Task Decomposer
│   │   │   ├── scheduler/    # Job Scheduler
│   │   │   ├── session/      # Session Pool
│   │   │   ├── worktree/     # Git Worktree Manager
│   │   │   ├── realtime/     # Supabase Realtime
│   │   │   └── db/           # Supabase Client
│   │   └── package.json
│   │
│   └── office-web/       # 프론트엔드 UI
│       ├── src/
│       │   ├── app/          # Next.js Pages
│       │   ├── components/   # React Components
│       │   ├── stores/       # Zustand Stores
│       │   ├── hooks/        # Custom Hooks
│       │   └── lib/          # Utilities & API Client
│       └── package.json
│
└── semo-system/
    └── semo-office/      # Skills & Agents 정의
        ├── skills/
        │   ├── create-worktree/
        │   ├── remove-worktree/
        │   ├── create-pr/
        │   ├── merge-pr/
        │   └── sync-branch/
        ├── agents/
        │   └── task-decomposer/
        ├── CLAUDE.md
        └── VERSION
```

## Quick Start

### 1. 환경 설정

```bash
# 모노레포 루트에서
cd semo

# 의존성 설치
npm install

# 환경변수 설정
cp packages/office-server/.env.example packages/office-server/.env
cp packages/office-web/.env.example packages/office-web/.env
```

### 2. Supabase 설정

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트 생성
2. SQL Editor에서 마이그레이션 실행:
   ```bash
   # 파일 내용을 SQL Editor에 붙여넣기
   cat semo-system/semo-remote/db/migrations/004_office_tables.sql
   ```
3. `.env` 파일에 Supabase 자격증명 입력

### 3. 서버 실행

```bash
# Backend (포트 3001)
npm run dev:server

# Frontend (포트 3002)
npm run dev:web
```

### 4. 접속

- Frontend: http://localhost:3002
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## API Reference

### Offices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices` | 오피스 목록 |
| POST | `/api/offices` | 오피스 생성 |
| GET | `/api/offices/:id` | 오피스 조회 |
| DELETE | `/api/offices/:id` | 오피스 삭제 |

### Tasks & Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/tasks` | 작업 요청 (자연어) |
| GET | `/api/offices/:id/jobs` | Job 목록 |
| GET | `/api/offices/:id/jobs/:jobId` | Job 상세 |
| PATCH | `/api/offices/:id/jobs/:jobId` | Job 상태 업데이트 |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/agents` | Agent 목록 |
| POST | `/api/offices/:id/agents` | Agent 생성 |
| PATCH | `/api/offices/:id/agents/:agentId` | Agent 업데이트 |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | 페르소나 목록 |
| POST | `/api/personas` | 커스텀 페르소나 생성 |

## Agent Roles

| Agent | 역할 | 담당 영역 | 코어 스킬 |
|-------|------|----------|----------|
| **PO** | Product Owner | 기획서, 명세서 | generate-spec |
| **PM** | Project Manager | 일정 관리 | planner, notify-slack |
| **Architect** | 설계자 | 시스템 설계 | planner, write-code |
| **FE** | Frontend Dev | UI/컴포넌트 | write-code, create-pr |
| **BE** | Backend Dev | API/서버 | write-code, create-pr |
| **QA** | QA Engineer | 테스트 | write-test |
| **DevOps** | DevOps | 배포/인프라 | deployer |

## Skills

### Git Worktree Skills

| Skill | 설명 |
|-------|------|
| `create-worktree` | Agent용 Git Worktree 생성 |
| `remove-worktree` | Worktree 정리 |
| `sync-branch` | main에서 rebase/merge |

### PR Skills

| Skill | 설명 |
|-------|------|
| `create-pr` | 작업 완료 후 PR 생성 |
| `merge-pr` | 의존성 순서로 PR 병합 |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Express.js, TypeScript |
| Frontend | Next.js 14, PixiJS, Tailwind CSS |
| State | Zustand |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Git | simple-git |

## Example Usage

### 1. 오피스 생성

```bash
curl -X POST http://localhost:3001/api/offices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project Office",
    "github_org": "my-org",
    "github_repo": "my-project",
    "repo_path": "/path/to/repo"
  }'
```

### 2. 작업 요청

```bash
curl -X POST http://localhost:3001/api/offices/{office_id}/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "task": "로그인 기능 구현해줘"
  }'
```

### 응답 예시

```json
{
  "message": "Task decomposed and enqueued",
  "summary": "로그인 - create",
  "jobs": [
    {
      "id": "job-fe-123",
      "description": "로그인 UI 구현 및 프론트엔드 개발",
      "status": "ready",
      "priority": 1
    },
    {
      "id": "job-be-124",
      "description": "로그인 API 구현 및 백엔드 개발",
      "status": "ready",
      "priority": 1
    },
    {
      "id": "job-qa-125",
      "description": "로그인 테스트 작성 및 품질 검증",
      "status": "pending",
      "depends_on": ["job-fe-123", "job-be-124"],
      "priority": 2
    }
  ],
  "execution_order": [
    ["job-fe-123", "job-be-124"],
    ["job-qa-125"]
  ],
  "estimated_agents": 3
}
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `offices` | 가상 오피스 (GitHub 레포 매핑) |
| `agent_personas` | Agent 페르소나 정의 |
| `worktrees` | Git Worktree 상태 |
| `office_agents` | Agent 인스턴스 |
| `job_queue` | 작업 큐 (의존성 관리) |
| `agent_messages` | Agent 간 메시지 |

## Development

### 디렉토리 구조

```bash
# Backend 개발
cd packages/office-server
npm run dev

# Frontend 개발
cd packages/office-web
npm run dev
```

### 빌드

```bash
# 전체 빌드
npm run build

# 개별 패키지 빌드
npm run build --workspace=@team-semicolon/semo-office-server
npm run build --workspace=@team-semicolon/semo-office-web
```

## Roadmap

### Phase 1 (MVP) ✅
- [x] DB 스키마 설계 및 마이그레이션
- [x] Task Decomposer 기본 구현
- [x] Worktree Manager
- [x] 기본 API 엔드포인트
- [x] 2D Office UI (PixiJS)

### Phase 2
- [ ] Sub-Agent 페르소나 통합
- [ ] Claude Code 세션 연동
- [ ] 실시간 Agent 상태 동기화
- [ ] PR 자동 생성/병합

### Phase 3
- [ ] 멀티 레포지토리 지원
- [ ] 커스텀 스킬 UI 에디터
- [ ] 대시보드 및 리포트
- [ ] 페르소나 커스터마이징 UI

## Related Docs

- [Migration Guide](../../semo-system/semo-remote/db/migrations/README.md)
- [semo-office Skills](../../semo-system/semo-office/CLAUDE.md)
- [office-server README](../../packages/office-server/README.md)
- [office-web README](../../packages/office-web/README.md)
