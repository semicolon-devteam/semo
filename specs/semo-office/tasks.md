# Semo Office - Implementation Tasks

> Phase별 구현 태스크 (DDD Layer 기반)

---

## Task Summary

| Phase | 설명 | 버전 | 태스크 수 |
|-------|------|------|-----------|
| Phase 1 | MVP - 기반 구축 | v0.1.x | 25 |
| Phase 2 | 세션 실행 통합 | v0.2.x | 18 |
| Phase 3 | 고급 기능 | v0.3.x | 15 |
| **Total** | | | **58** |

---

## Phase 1: MVP - 기반 구축 (v0.1.x)

> DB 스키마, 기본 API, 2D UI, Worktree 관리

### Layer 0: CONFIG (v0.1.0)

#### TASK-P1-001: DB 스키마 설계 및 마이그레이션

**파일**: `semo-system/semo-remote/db/migrations/004_office_tables.sql`

**작업 내용**:
- [ ] offices 테이블 생성
- [ ] agent_personas 테이블 생성
- [ ] worktrees 테이블 생성
- [ ] office_agents 테이블 생성
- [ ] job_queue 테이블 생성
- [ ] agent_messages 테이블 생성
- [ ] 인덱스 및 FK 설정
- [ ] RLS 정책 설정
- [ ] 기본 Persona 시드 데이터

**AC**:
- Supabase SQL Editor에서 실행 가능
- RLS 정책으로 office_id 기반 데이터 격리

---

#### TASK-P1-002: 환경 설정 파일

**파일**: `packages/office-server/.env.example`, `packages/office-web/.env.example`

**작업 내용**:
- [ ] SUPABASE_URL, SUPABASE_KEY 설정
- [ ] GITHUB_TOKEN 설정
- [ ] API_URL 설정 (프론트엔드)
- [ ] 포트 설정 (3001, 3002)

---

#### TASK-P1-003: 패키지 초기화

**파일**: `packages/office-server/`, `packages/office-web/`

**작업 내용**:
- [ ] office-server: Express + TypeScript 설정
- [ ] office-web: Next.js 14 + Tailwind 설정
- [ ] tsconfig.json 설정
- [ ] package.json 스크립트 설정

---

### Layer 1: DATA (v0.1.1)

#### TASK-P1-004: TypeScript 타입 정의 (Backend)

**파일**: `packages/office-server/src/types.ts`

**작업 내용**:
```typescript
// 정의할 인터페이스
interface Office { ... }
interface AgentPersona { ... }
interface Worktree { ... }
interface OfficeAgent { ... }
interface Job { ... }
interface AgentMessage { ... }

type AgentRole = 'PO' | 'PM' | 'Architect' | 'FE' | 'BE' | 'QA' | 'DevOps';
type JobStatus = 'pending' | 'ready' | 'processing' | 'done' | 'failed';
type AgentStatus = 'idle' | 'working' | 'blocked';
```

---

#### TASK-P1-005: TypeScript 타입 정의 (Frontend)

**파일**: `packages/office-web/src/lib/types.ts`

**작업 내용**:
- [ ] API 응답 타입
- [ ] UI 컴포넌트 Props 타입
- [ ] Store 상태 타입

---

### Layer 2: INFRA (v0.1.2)

#### TASK-P1-006: Supabase 클라이언트 설정

**파일**: `packages/office-server/src/db/supabase.ts`

**작업 내용**:
- [ ] createClient 설정
- [ ] 타입 안전 쿼리 래퍼
- [ ] 에러 핸들링

---

#### TASK-P1-007: Git 작업 래퍼 (simple-git)

**파일**: `packages/office-server/src/worktree/gitOperations.ts`

**작업 내용**:
```typescript
class GitOperations {
  async worktreeAdd(path: string, branch: string): Promise<void>;
  async worktreeRemove(path: string): Promise<void>;
  async worktreeList(): Promise<WorktreeInfo[]>;
  async branchCreate(name: string, from?: string): Promise<void>;
  async branchDelete(name: string): Promise<void>;
}
```

---

#### TASK-P1-008: Supabase 클라이언트 (Frontend)

**파일**: `packages/office-web/src/lib/supabase.ts`

**작업 내용**:
- [ ] 브라우저용 Supabase 클라이언트
- [ ] Realtime 연결 설정

---

### Layer 3: APPLICATION (v0.1.3)

#### TASK-P1-009: Task Decomposer 기본 구현

**파일**: `packages/office-server/src/decomposer/index.ts`

**작업 내용**:
```typescript
class TaskDecomposer {
  async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
    // 1. 프로젝트 컨텍스트 분석 (간단 버전)
    // 2. 역할별 Job 생성 (FE, BE, QA)
    // 3. 의존성 그래프 생성
    // 4. Persona 매칭
  }
}
```

**AC**:
- "로그인 기능 구현해줘" → 3개 Job 생성 (FE, BE, QA)
- 의존성: QA는 FE, BE 완료 후

---

#### TASK-P1-010: Job Scheduler 기본 구현

**파일**: `packages/office-server/src/scheduler/index.ts`

**작업 내용**:
```typescript
class JobScheduler {
  async enqueueJobs(jobs: Job[]): Promise<void>;
  async getReadyJobs(officeId: string): Promise<Job[]>;
  async markJobComplete(jobId: string): Promise<void>;
  async updateDependentJobs(jobId: string): Promise<void>;
}
```

---

#### TASK-P1-011: Worktree Manager 구현

**파일**: `packages/office-server/src/worktree/manager.ts`

**작업 내용**:
```typescript
class WorktreeManager {
  async createWorktree(officeId: string, agentRole: string): Promise<Worktree>;
  async removeWorktree(worktreeId: string): Promise<void>;
  async getWorktrees(officeId: string): Promise<Worktree[]>;
  async syncWithMain(worktreeId: string): Promise<void>;
}
```

---

#### TASK-P1-012: Session Pool 기본 구현

**파일**: `packages/office-server/src/session/pool.ts`

**작업 내용**:
```typescript
class SessionPool {
  async acquireSession(officeId: string, agentRole: string): Promise<Session>;
  async releaseSession(sessionId: string): Promise<void>;
  async getActiveSessions(officeId: string): Promise<Session[]>;
}
```

---

#### TASK-P1-013: Realtime Handler

**파일**: `packages/office-server/src/realtime/broadcast.ts`

**작업 내용**:
```typescript
class RealtimeHandler {
  async broadcastAgentUpdate(officeId: string, agent: Agent): Promise<void>;
  async broadcastJobUpdate(officeId: string, job: Job): Promise<void>;
  async broadcastMessage(officeId: string, message: Message): Promise<void>;
}
```

---

### Layer 4: PRESENTATION (v0.1.4)

#### TASK-P1-014: Express API 설정

**파일**: `packages/office-server/src/api/index.ts`

**작업 내용**:
- [ ] Express 앱 생성
- [ ] CORS 설정
- [ ] 에러 핸들링 미들웨어
- [ ] 라우트 등록

---

#### TASK-P1-015: Offices API 라우트

**파일**: `packages/office-server/src/api/routes/offices.ts`

**작업 내용**:
- [ ] GET /api/offices - 목록
- [ ] POST /api/offices - 생성
- [ ] GET /api/offices/:id - 조회
- [ ] DELETE /api/offices/:id - 삭제

---

#### TASK-P1-016: Tasks API 라우트

**파일**: `packages/office-server/src/api/routes/tasks.ts`

**작업 내용**:
- [ ] POST /api/offices/:id/tasks - 작업 요청

---

#### TASK-P1-017: Jobs API 라우트

**파일**: `packages/office-server/src/api/routes/jobs.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/jobs - 목록
- [ ] GET /api/offices/:id/jobs/:jobId - 상세
- [ ] PATCH /api/offices/:id/jobs/:jobId - 상태 업데이트

---

#### TASK-P1-018: Agents API 라우트

**파일**: `packages/office-server/src/api/routes/agents.ts`

**작업 내용**:
- [ ] GET /api/offices/:id/agents - 목록
- [ ] POST /api/offices/:id/agents - 생성
- [ ] PATCH /api/offices/:id/agents/:agentId - 업데이트

---

#### TASK-P1-019: Personas API 라우트

**파일**: `packages/office-server/src/api/routes/personas.ts`

**작업 내용**:
- [ ] GET /api/personas - 목록
- [ ] POST /api/personas - 생성

---

### Layer 5: UI (v0.1.5)

#### TASK-P1-020: Next.js 페이지 구조

**파일**: `packages/office-web/src/app/`

**작업 내용**:
- [ ] page.tsx - 홈 (Office 목록)
- [ ] office/[id]/page.tsx - Office 뷰
- [ ] layout.tsx - 공통 레이아웃

---

#### TASK-P1-021: Zustand Store 설정

**파일**: `packages/office-web/src/stores/`

**작업 내용**:
- [ ] officeStore.ts - Office 상태
- [ ] agentStore.ts - Agent 상태
- [ ] jobStore.ts - Job 상태

---

#### TASK-P1-022: PixiJS Office 컴포넌트

**파일**: `packages/office-web/src/components/office/`

**작업 내용**:
- [ ] OfficeStage.tsx - PixiJS 컨테이너
- [ ] OfficeBackground.tsx - 타일맵 배경
- [ ] AgentSprite.tsx - Agent 아바타
- [ ] MessageBubble.tsx - 말풍선

---

#### TASK-P1-023: Dashboard 컴포넌트

**파일**: `packages/office-web/src/components/dashboard/`

**작업 내용**:
- [ ] OfficeCard.tsx - Office 카드
- [ ] JobList.tsx - Job 목록
- [ ] ChatLog.tsx - 대화 로그

---

#### TASK-P1-024: Realtime Hooks

**파일**: `packages/office-web/src/hooks/`

**작업 내용**:
- [ ] useRealtimeAgents.ts
- [ ] useRealtimeJobs.ts
- [ ] useRealtimeMessages.ts

---

#### TASK-P1-025: API 클라이언트

**파일**: `packages/office-web/src/lib/api.ts`

**작업 내용**:
```typescript
const api = {
  offices: {
    list: () => fetch('/api/offices'),
    create: (data) => fetch('/api/offices', { method: 'POST', body: data }),
    // ...
  },
  // ...
};
```

---

## Phase 2: 세션 실행 통합 (v0.2.x)

> semo-remote-client 연동, 실제 Claude Code 세션 실행

### Layer 0: CONFIG (v0.2.0)

#### TASK-P2-001: DB 스키마 확장

**파일**: `005_office_commands.sql`

**작업 내용**:
- [ ] agent_commands 테이블
- [ ] agent_command_results 테이블
- [ ] agent_sessions 테이블
- [ ] Realtime 활성화

---

#### TASK-P2-002: semo-remote-client 환경 설정

**파일**: `semo-remote-client/.env`

**작업 내용**:
- [ ] SEMO_OFFICE_MODE 환경변수
- [ ] SEMO_OFFICE_ID 환경변수

---

### Layer 1: DATA (v0.2.1)

#### TASK-P2-003: Command/Result 타입 정의

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
- [ ] AgentCommand 인터페이스
- [ ] CommandResult 인터페이스
- [ ] CommandType union
- [ ] OfficeDependencies 인터페이스

---

### Layer 2: INFRA (v0.2.2)

#### TASK-P2-004: Office Command Subscriber

**파일**: `semo-remote-client/src/main/officeSubscriber.ts`

**작업 내용**:
- [ ] Realtime 구독 (agent_commands)
- [ ] 폴링 fallback
- [ ] 중복 처리 방지
- [ ] 결과 저장

---

#### TASK-P2-005: Session Executor 연동

**파일**: `packages/office-server/src/session/executor.ts`

**작업 내용**:
- [ ] agent_commands INSERT
- [ ] agent_command_results 구독
- [ ] 결과 대기 및 처리

---

### Layer 3: APPLICATION (v0.2.3)

#### TASK-P2-006: handleCreateSession

**파일**: `officeSubscriber.ts`

**작업 내용**:
- [ ] iTerm 탭 생성
- [ ] Claude Code 실행
- [ ] agent_sessions 등록
- [ ] 초기 프롬프트 전송

---

#### TASK-P2-007: handleSendPrompt

**작업 내용**:
- [ ] AppleScript로 프롬프트 전송
- [ ] 결과 반환

---

#### TASK-P2-008: handleGetOutput, handleCancel, handleTerminate

**작업 내용**:
- [ ] 세션 출력 조회
- [ ] Ctrl+C 전송
- [ ] 세션 종료

---

#### TASK-P2-009: main/index.ts 통합

**파일**: `semo-remote-client/src/main/index.ts`

**작업 내용**:
- [ ] Office Mode 환경변수 처리
- [ ] officeSubscriber 초기화
- [ ] IPC 핸들러 추가
- [ ] before-quit 정리

---

#### TASK-P2-010: PR 자동 생성 감지

**파일**: `packages/office-server/src/session/monitor.ts`

**작업 내용**:
- [ ] PR 생성 감지 로직
- [ ] Job 완료 처리
- [ ] 다음 Job 트리거

---

### Layer 4: UI (v0.2.4)

#### TASK-P2-011: Agent 상태 실시간 표시

**파일**: `packages/office-web/src/components/office/AgentSprite.tsx`

**작업 내용**:
- [ ] 상태별 애니메이션
- [ ] 현재 작업 말풍선
- [ ] 세션 연결 상태 표시

---

#### TASK-P2-012: Job 진행률 상세 표시

**파일**: `packages/office-web/src/components/dashboard/JobList.tsx`

**작업 내용**:
- [ ] 실시간 상태 업데이트
- [ ] PR 링크 표시
- [ ] 에러 상태 표시

---

### Layer 5: TESTS (v0.2.5)

#### TASK-P2-013: 단위 테스트

**파일**: `packages/office-server/src/**/__tests__/`

**작업 내용**:
- [ ] TaskDecomposer 테스트
- [ ] JobScheduler 테스트
- [ ] WorktreeManager 테스트

---

#### TASK-P2-014: 통합 테스트

**파일**: `packages/office-server/e2e/`

**작업 내용**:
- [ ] API 엔드포인트 테스트
- [ ] 명령 전송/수신 테스트

---

#### TASK-P2-015: E2E 테스트

**작업 내용**:
- [ ] 전체 워크플로우 테스트
- [ ] UI 상호작용 테스트

---

### DOCS (v0.2.6)

#### TASK-P2-016: README 문서화

**파일**: `docs/semo-office/README.md`

**작업 내용**:
- [ ] Quick Start 가이드
- [ ] API 레퍼런스
- [ ] 트러블슈팅

---

#### TASK-P2-017: INTEGRATION.md 업데이트

**파일**: `docs/semo-office/INTEGRATION.md`

**작업 내용**:
- [ ] 통합 아키텍처 다이어그램
- [ ] 설정 가이드

---

#### TASK-P2-018: semo-office Skills 문서화

**파일**: `semo-system/semo-office/skills/*/SKILL.md`

**작업 내용**:
- [ ] 각 스킬 사용법 문서화

---

## Phase 3: 고급 기능 (v0.3.x)

> 멀티 레포, 커스터마이징, 대시보드

### v0.3.0: 멀티 레포지토리

#### TASK-P3-001: 멀티 레포 Office 지원

**작업 내용**:
- [ ] Office당 여러 레포 매핑
- [ ] 레포 간 의존성 관리

---

#### TASK-P3-002: 레포별 Worktree 관리

**작업 내용**:
- [ ] 레포별 Worktree 구조
- [ ] 브랜치 명명 규칙 확장

---

### v0.3.1: 커스터마이징

#### TASK-P3-003: Persona 에디터 UI

**작업 내용**:
- [ ] Persona 생성/수정 폼
- [ ] 프리뷰 기능

---

#### TASK-P3-004: 커스텀 스킬 등록

**작업 내용**:
- [ ] custom_skills 테이블
- [ ] 스킬 등록 API
- [ ] Persona에 스킬 연결

---

#### TASK-P3-005: Office 레이아웃 에디터

**작업 내용**:
- [ ] 드래그 앤 드롭 배치
- [ ] 가구 추가/제거
- [ ] 레이아웃 저장

---

### v0.3.2: 대시보드

#### TASK-P3-006: 작업 히스토리 뷰

**작업 내용**:
- [ ] 완료된 작업 목록
- [ ] PR 히스토리
- [ ] 통계 요약

---

#### TASK-P3-007: Agent 성과 대시보드

**작업 내용**:
- [ ] Agent별 완료 작업 수
- [ ] 평균 작업 시간
- [ ] 성공/실패율

---

#### TASK-P3-008: 실시간 모니터링

**작업 내용**:
- [ ] 리소스 사용량 표시
- [ ] 세션 상태 모니터링
- [ ] 알림 설정

---

### v0.3.3: 안정성 개선

#### TASK-P3-009: 에러 복구 자동화

**작업 내용**:
- [ ] 세션 끊김 자동 재연결
- [ ] 실패한 Job 재시도
- [ ] Circuit Breaker 패턴

---

#### TASK-P3-010: 타임아웃 관리

**작업 내용**:
- [ ] Job 타임아웃 설정
- [ ] 세션 idle 타임아웃
- [ ] 자동 정리

---

#### TASK-P3-011: 로깅 및 관측성

**작업 내용**:
- [ ] 구조화된 로깅
- [ ] 메트릭 수집
- [ ] 트레이싱

---

### v0.3.4: 성능 최적화

#### TASK-P3-012: Worktree 최적화

**작업 내용**:
- [ ] 얕은 클론 적용
- [ ] Sparse checkout
- [ ] 캐싱 전략

---

#### TASK-P3-013: UI 렌더링 최적화

**작업 내용**:
- [ ] 스프라이트 시트 사용
- [ ] 가상화 (많은 Agent)
- [ ] 메모이제이션

---

#### TASK-P3-014: DB 쿼리 최적화

**작업 내용**:
- [ ] 인덱스 추가
- [ ] 쿼리 배치
- [ ] 캐싱

---

#### TASK-P3-015: 문서화 완성

**작업 내용**:
- [ ] 아키텍처 문서
- [ ] 배포 가이드
- [ ] 기여 가이드

---

## Dependencies Graph

```
Phase 1:
  CONFIG → DATA → INFRA → APPLICATION → PRESENTATION → UI

Phase 2:
  CONFIG → DATA → INFRA → APPLICATION → UI → TESTS → DOCS

Phase 3:
  멀티레포 → 커스터마이징 → 대시보드 → 안정성 → 성능 → 문서화
```

---

## Completion Checklist

### Phase 1 (MVP)
- [ ] DB 스키마 완료
- [ ] 기본 API 동작
- [ ] 2D Office UI 렌더링
- [ ] Task Decomposition 동작
- [ ] Worktree 생성/삭제

### Phase 2 (세션 통합)
- [ ] semo-remote-client 연동
- [ ] Claude Code 세션 생성
- [ ] 프롬프트 전송
- [ ] 작업 완료 감지
- [ ] 테스트 커버리지 > 70%

### Phase 3 (고급 기능)
- [ ] 멀티 레포 지원
- [ ] Persona 에디터
- [ ] 대시보드
- [ ] 안정성 개선
- [ ] 성능 최적화
