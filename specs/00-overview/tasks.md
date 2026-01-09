# Semo Office - Overview Tasks

> 전체 프로젝트 태스크 및 모듈 간 의존성

---

## Project Setup

### ENV-001: 프로젝트 환경 구성
- [ ] Monorepo 구조 설정 (Turborepo)
- [ ] TypeScript 설정 (strict mode)
- [ ] ESLint + Prettier 설정
- [ ] Husky + Lint-staged
- [ ] 의존성: 없음
- [ ] 우선순위: P0 (최우선)

### ENV-002: 데이터베이스 설정
- [ ] Supabase 프로젝트 생성
- [ ] 로컬 Supabase 개발 환경
- [ ] DB 마이그레이션 설정
- [ ] 의존성: ENV-001
- [ ] 우선순위: P0

---

## Core Modules (MVP 필수)

### CORE-001: Office/Agent/Persona CRUD
- [ ] DB 스키마 생성
- [ ] API 엔드포인트 구현
- [ ] 기본 UI 컴포넌트
- [ ] 의존성: ENV-002
- [ ] 우선순위: P0
- [ ] 상세: [01-core/tasks.md](../01-core/tasks.md)

### DECOMP-001: Task Decomposer
- [ ] Decomposer Agent 세션 구현
- [ ] 자연어 → Job 분해 로직
- [ ] 의존성 그래프 생성
- [ ] 의존성: CORE-001
- [ ] 우선순위: P0
- [ ] 상세: [02-task-decomposer/tasks.md](../02-task-decomposer/tasks.md)

### WORKTREE-001: Worktree 관리
- [ ] Git Worktree 생성/삭제
- [ ] 브랜치 동기화
- [ ] Worktree 상태 관리
- [ ] 의존성: CORE-001
- [ ] 우선순위: P0
- [ ] 상세: [03-worktree/tasks.md](../03-worktree/tasks.md)

### SESSION-001: Session Execution
- [ ] node-pty 기반 세션 관리
- [ ] Persona 주입
- [ ] 작업 완료 감지
- [ ] 의존성: WORKTREE-001
- [ ] 우선순위: P0
- [ ] 상세: [04-session-execution/tasks.md](../04-session-execution/tasks.md)

### SCHEDULER-001: Job Scheduler
- [ ] 의존성 해결기
- [ ] 실행 큐 관리
- [ ] 타임아웃/재시도 정책
- [ ] 의존성: SESSION-001
- [ ] 우선순위: P0
- [ ] 상세: [08-job-scheduler/tasks.md](../08-job-scheduler/tasks.md)

### PR-001: PR Workflow
- [ ] PR 자동 생성
- [ ] 의존성 순서 병합
- [ ] Worktree 정리
- [ ] 의존성: SESSION-001
- [ ] 우선순위: P0
- [ ] 상세: [05-pr-workflow/tasks.md](../05-pr-workflow/tasks.md)

### UI-001: 기본 UI (MVP)
- [ ] Office 선택 화면
- [ ] 작업 진행 상태 표시
- [ ] 명령 입력창
- [ ] 의존성: CORE-001
- [ ] 우선순위: P0
- [ ] 상세: [06-realtime-ui/tasks.md](../06-realtime-ui/tasks.md)

---

## Advanced Features (Post-MVP)

### UI-002: GatherTown 스타일 UI
- [ ] PixiJS 오피스 뷰
- [ ] Agent 아바타 및 애니메이션
- [ ] 실시간 동기화
- [ ] 의존성: UI-001, SESSION-001
- [ ] 우선순위: P1
- [ ] 상세: [06-realtime-ui/tasks.md](../06-realtime-ui/tasks.md)

### COMM-001: Agent Communication
- [ ] 메시지 전송
- [ ] 작업 핸드오프
- [ ] 협업 세션
- [ ] 의존성: SESSION-001
- [ ] 우선순위: P1
- [ ] 상세: [07-agent-communication/tasks.md](../07-agent-communication/tasks.md)

---

## Milestone Summary

### v0.1.0 - MVP (Phase 1)
**목표**: 기본 멀티에이전트 협업 동작

**포함 모듈**:
- CORE-001: Office/Agent/Persona CRUD
- DECOMP-001: Task Decomposer
- WORKTREE-001: Worktree 관리
- SESSION-001: Session Execution
- SCHEDULER-001: Job Scheduler
- PR-001: PR Workflow
- UI-001: 기본 UI

**완료 조건**:
- [ ] 자연어 요청 → Job 분해 → Agent 실행 → PR 생성 플로우 동작
- [ ] 최소 3개 Agent (FE, BE, QA) 병렬 실행
- [ ] Git 충돌 없이 PR 병합 완료
- [ ] 기본 UI에서 진행 상황 확인 가능

**예상 기간**: 4주

---

### v0.2.0 - Enhanced UI (Phase 2)
**목표**: 실시간 시각화 및 Agent 간 통신

**포함 모듈**:
- UI-002: GatherTown 스타일 UI
- COMM-001: Agent Communication

**완료 조건**:
- [ ] 2D 오피스 뷰에서 Agent 상태 실시간 확인
- [ ] Agent 간 메시지 및 핸드오프 동작
- [ ] 협업 세션 기능

**예상 기간**: 3주

---

### v0.3.0 - Production Ready (Phase 3)
**목표**: 안정성 및 확장성

**완료 조건**:
- [ ] 에러 핸들링 강화
- [ ] 모니터링 및 로깅
- [ ] 성능 최적화
- [ ] 문서화 완료

**예상 기간**: 2주

---

## Dependencies Graph

```text
ENV-001 (프로젝트 환경)
   │
   ▼
ENV-002 (DB 설정)
   │
   ├──▶ CORE-001 (Office/Agent/Persona)
   │       │
   │       ├──▶ DECOMP-001 (Task Decomposer)
   │       │
   │       ├──▶ WORKTREE-001 (Worktree)
   │       │       │
   │       │       ▼
   │       ├──▶ SESSION-001 (Session Execution)
   │       │       │
   │       │       ├──▶ SCHEDULER-001 (Job Scheduler)
   │       │       │
   │       │       └──▶ PR-001 (PR Workflow)
   │       │
   │       └──▶ UI-001 (기본 UI)
   │               │
   │               └──▶ UI-002 (GatherTown UI)
   │
   └──▶ COMM-001 (Agent Communication)
```

---

## Critical Path

```text
ENV-001 → ENV-002 → CORE-001 → WORKTREE-001 → SESSION-001 → SCHEDULER-001 → PR-001
```

위 경로의 모든 태스크가 완료되어야 MVP (v0.1.0) 동작 가능

---

## Risk & Mitigation

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| Git Worktree 동시성 이슈 | 높음 | 철저한 브랜치 격리 및 테스트 |
| Claude Code 세션 안정성 | 높음 | Circuit Breaker, 재시도 정책 |
| 의존성 그래프 순환 | 중간 | 토폴로지 정렬 검증 |
| PR 병합 충돌 | 중간 | 자동 rebase 시도, 수동 해결 가이드 |
| UI 성능 (PixiJS) | 낮음 | 렌더링 최적화, Agent 수 제한 |

---

## Success Metrics

| 메트릭 | 목표 | 측정 방법 |
|--------|------|----------|
| 작업 완료율 | > 90% | 완료된 Job / 전체 Job |
| Git 충돌 발생률 | 0% | Worktree 격리 검증 |
| 평균 작업 시간 | < 30분 | Job 시작 ~ 완료 시간 |
| 세션 오류율 | < 5% | 실패한 세션 / 전체 세션 |
| UI 렌더링 | > 30 FPS | PixiJS 성능 모니터링 |
