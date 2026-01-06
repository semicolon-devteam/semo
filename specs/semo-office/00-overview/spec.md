# Semo Office - Overview

> GatherTown 스타일 가상 오피스에서 AI Agent들이 협업하는 멀티에이전트 시스템

---

## Vision

소프트웨어 개발 팀을 AI Agent로 구성하여, 자연어 요청 하나로 **전체 개발 사이클**(기획 → 설계 → 구현 → 테스트 → 배포)을 자동화합니다.

---

## Problem Statement

| 문제 | 해결책 |
|------|--------|
| 단일 Agent 한계 | Git Worktree로 물리적 격리, 병렬 실행 |
| Git 충돌 | Agent별 독립 브랜치 + PR 기반 병합 |
| 페르소나 혼란 | Sub-Agent별 전용 세션 + 페르소나 프롬프트 |
| 진행 상황 불투명 | GatherTown 스타일 실시간 시각화 |
| 의존성 관리 | DAG 기반 Job Scheduler |

---

## Core Concepts

| 개념 | 설명 |
|------|------|
| **Office** | GitHub Repo와 매핑된 가상 작업 공간 |
| **Agent** | 특정 역할(FE, BE, QA)을 수행하는 AI 작업자 |
| **Persona** | Agent의 성격, 전문 영역, 업무 스타일 |
| **Worktree** | Agent별 독립된 Git worktree 디렉토리 |
| **Job** | Agent가 수행할 단위 작업 |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         office-web                               │
│                    (Next.js + PixiJS)                           │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ REST API + Realtime
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        office-server                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Task      │  │    Job      │  │    Session              │  │
│  │ Decomposer  │→ │  Scheduler  │→ │    Executor             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                          │                    │                  │
│                  ┌───────┴───────┐            │                  │
│                  │   Worktree    │            │                  │
│                  │   Manager     │            │                  │
│                  └───────────────┘            │                  │
└──────────────────────────────────────────────│──────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────┐
              │           Supabase             │                │
              │  ┌──────────────────────────┐  │                │
              │  │ offices, agents, jobs,   │  │                │
              │  │ commands, sessions       │  │                │
              │  └──────────────────────────┘  │                │
              └────────────────────────────────│────────────────┘
                                               │ Realtime
                                               ▼
                              ┌─────────────────────────────────┐
                              │       semo-remote-client        │
                              │  ┌───────────────────────────┐  │
                              │  │  Office Command Subscriber │  │
                              │  │  + iTerm2 Python API       │  │
                              │  └───────────────────────────┘  │
                              │              │                  │
                              │              ▼                  │
                              │     Claude Code Sessions        │
                              └─────────────────────────────────┘
```

---

## Feature Modules

| 모듈 | Spec 위치 | 설명 |
|------|-----------|------|
| **Core** | `01-core/` | Office, Agent, Persona CRUD |
| **Task Decomposer** | `02-task-decomposer/` | 자연어 → Job 분해 |
| **Worktree** | `03-worktree/` | Git Worktree 생성/관리 |
| **Session Execution** | `04-session-execution/` | Claude Code 세션 제어 |
| **PR Workflow** | `05-pr-workflow/` | PR 생성/머지 자동화 |
| **Realtime UI** | `06-realtime-ui/` | 2D Office 뷰, 실시간 동기화 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, PixiJS, Tailwind, Zustand |
| Backend | Express, TypeScript |
| Database | Supabase (PostgreSQL + Realtime) |
| Git | simple-git, gh CLI |
| Session | semo-remote-client, iTerm2 Python API |

---

## Success Metrics

| 메트릭 | 목표 |
|--------|------|
| 작업 완료율 | > 90% (사람 개입 없이) |
| 충돌 발생률 | 0% (Worktree 격리) |
| 평균 작업 시간 | 단독 대비 50% 감소 |
| UI 렌더링 | > 30 FPS |

---

## Implementation Phases

| Phase | 버전 | 핵심 기능 |
|-------|------|-----------|
| **Phase 1** | v0.1.x | MVP - Core, Task Decomposer, Worktree, 기본 UI |
| **Phase 2** | v0.2.x | Session Execution, PR Workflow |
| **Phase 3** | v0.3.x | 고급 기능 - 멀티 레포, 커스터마이징, 대시보드 |

---

## Related Specs

- [01-core](../01-core/spec.md) - Office/Agent/Persona 관리
- [02-task-decomposer](../02-task-decomposer/spec.md) - 작업 분해
- [03-worktree](../03-worktree/spec.md) - Git Worktree 관리
- [04-session-execution](../04-session-execution/spec.md) - 세션 실행
- [05-pr-workflow](../05-pr-workflow/spec.md) - PR 워크플로우
- [06-realtime-ui](../06-realtime-ui/spec.md) - 실시간 UI
