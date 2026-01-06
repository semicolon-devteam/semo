# Semo Office - Full Specification

> GatherTown 스타일 가상 오피스에서 AI Agent들이 협업하는 멀티에이전트 시스템

---

## Vision

소프트웨어 개발 팀을 AI Agent로 구성하여, 자연어 요청 하나로 **전체 개발 사이클**(기획 → 설계 → 구현 → 테스트 → 배포)을 자동화합니다.

2D 픽셀아트 스타일의 가상 오피스에서 각 Agent가 실시간으로 협업하는 모습을 시각화하여, 사용자가 AI 팀의 작업 진행 상황을 직관적으로 모니터링할 수 있습니다.

---

## Problem Statement

### 현재 한계

1. **단일 Agent 한계**: Claude Code 단독으로는 대규모 프로젝트의 병렬 작업 불가
2. **충돌 위험**: 여러 작업을 동시에 진행하면 Git 충돌 발생
3. **컨텍스트 혼란**: 하나의 세션에서 여러 역할을 수행하면 페르소나 혼란
4. **진행 상황 불투명**: 복잡한 작업의 진행률 파악 어려움
5. **의존성 관리 부재**: 작업 간 순서/의존성 수동 관리 필요

### 해결 방안

| 문제 | 해결책 |
|------|--------|
| 병렬 작업 불가 | Git Worktree로 물리적 격리 |
| Git 충돌 | Agent별 독립 브랜치 + PR 기반 병합 |
| 페르소나 혼란 | Sub-Agent별 전용 세션 + 페르소나 프롬프트 |
| 진행 상황 불투명 | GatherTown 스타일 실시간 시각화 |
| 의존성 관리 | DAG 기반 Job Scheduler |

---

## Goals

### Primary Goals

1. **완전 자동화**: "로그인 기능 구현해줘" → 자동으로 FE/BE/QA 협업 → PR 생성
2. **충돌 제로**: Git Worktree 물리적 격리로 충돌 원천 봉쇄
3. **실시간 가시성**: Agent 상태, 대화, 작업 진행률 실시간 표시
4. **확장 가능**: 커스텀 Agent/Skill 추가 가능

### Success Metrics

| 메트릭 | 목표 |
|--------|------|
| 작업 완료율 | > 90% (사람 개입 없이 완료) |
| 충돌 발생률 | 0% (Worktree 격리) |
| 평균 작업 시간 | 단독 대비 50% 감소 (병렬화) |
| 사용자 만족도 | > 4.5/5 (진행 상황 가시성) |

---

## Core Concepts

### Office

GitHub Repository와 매핑된 가상 작업 공간입니다.

```typescript
interface Office {
  id: string;
  name: string;
  github_org: string;
  github_repo: string;
  repo_path: string;  // 로컬 레포 경로
  layout: OfficeLayout;  // 2D 배치 정보
}
```

### Agent

특정 역할을 수행하는 AI 작업자입니다.

```typescript
interface Agent {
  id: string;
  office_id: string;
  persona_id: string;
  worktree_id: string;
  session_id: string;  // Claude Code 세션 ID
  status: 'idle' | 'working' | 'blocked';
  position: { x: number; y: number };  // 오피스 내 위치
}
```

### Persona

Agent의 성격, 전문 영역, 업무 스타일을 정의합니다.

```typescript
interface Persona {
  id: string;
  role: AgentRole;
  name: string;  // "김프론트", "이백엔드"
  avatar_config: AvatarConfig;
  persona_prompt: string;  // 성격/스타일 정의
  scope_patterns: string[];  // 담당 파일 패턴
  core_skills: string[];  // 사용 가능 스킬
}
```

### Worktree

Agent별 독립된 Git 작업 디렉토리입니다.

```typescript
interface Worktree {
  id: string;
  office_id: string;
  agent_role: string;
  path: string;  // /workspace/agent/fe
  branch: string;  // feature/fe-login
  status: 'idle' | 'working' | 'blocked';
}
```

### Job

Agent가 수행할 단위 작업입니다.

```typescript
interface Job {
  id: string;
  office_id: string;
  agent_id: string;
  description: string;
  status: 'pending' | 'ready' | 'processing' | 'done' | 'failed';
  depends_on: string[];  // 의존하는 Job ID
  pr_number?: number;
  branch_name: string;
}
```

---

## User Stories

### Epic 1: Office 관리

#### US-1.1: Office 생성

**As a** 개발자
**I want to** GitHub 레포지토리를 Office로 등록
**So that** AI Agent들이 해당 프로젝트에서 협업할 수 있음

**Acceptance Criteria:**
- [ ] GitHub org/repo 입력으로 Office 생성
- [ ] 로컬 레포 경로 자동 감지 또는 수동 입력
- [ ] 기본 Agent(FE, BE, QA) 자동 생성
- [ ] 기본 Worktree 구조 초기화

#### US-1.2: Office 목록 조회

**As a** 사용자
**I want to** 등록된 Office 목록을 확인
**So that** 작업할 Office를 선택할 수 있음

**Acceptance Criteria:**
- [ ] Office 목록 카드 형태 표시
- [ ] 각 Office의 Agent 수, 진행 중 작업 표시
- [ ] 최근 활동 시간 표시

#### US-1.3: Office 삭제

**As a** 사용자
**I want to** 더 이상 사용하지 않는 Office 삭제
**So that** 리소스를 정리할 수 있음

**Acceptance Criteria:**
- [ ] 삭제 확인 다이얼로그
- [ ] 관련 Worktree 자동 정리
- [ ] 진행 중 작업이 있으면 경고

---

### Epic 2: Task Decomposition

#### US-2.1: 자연어 작업 요청

**As a** 개발자
**I want to** 자연어로 작업을 요청
**So that** 세부 구현을 신경 쓰지 않아도 됨

**Acceptance Criteria:**
- [ ] 채팅 형태의 입력 인터페이스
- [ ] "로그인 기능 구현해줘" 같은 자연어 처리
- [ ] 작업 분해 결과 미리보기

#### US-2.2: Job 자동 분해

**As a** Task Decomposer Agent
**I want to** 사용자 요청을 역할별 Job으로 분해
**So that** 적절한 Agent에게 작업 할당 가능

**Acceptance Criteria:**
- [ ] 프로젝트 컨텍스트(기술 스택, 구조) 분석
- [ ] 역할별(FE/BE/QA) Job 생성
- [ ] 의존성 관계 자동 추론
- [ ] Job 설명에 구체적인 작업 내용 포함

#### US-2.3: Persona 매칭

**As a** Task Decomposer Agent
**I want to** Job에 적합한 Persona 매칭
**So that** 전문성에 맞는 작업 수행 가능

**Acceptance Criteria:**
- [ ] Job 내용과 Persona scope_patterns 매칭
- [ ] 여러 Persona 적합 시 우선순위 결정
- [ ] 커스텀 Persona 지원

---

### Epic 3: Git Worktree 관리

#### US-3.1: Worktree 생성

**As a** Agent
**I want to** 작업용 Worktree 생성
**So that** 다른 Agent와 독립적으로 작업 가능

**Acceptance Criteria:**
- [ ] `git worktree add` 실행
- [ ] 브랜치명 규칙: `feature/{role}-{task-id}`
- [ ] Worktree 경로: `/workspace/agent/{role}/`
- [ ] 기본 브랜치에서 분기

#### US-3.2: Worktree 정리

**As a** 시스템
**I want to** 작업 완료된 Worktree 정리
**So that** 디스크 공간 확보

**Acceptance Criteria:**
- [ ] PR 머지 후 자동 정리
- [ ] `git worktree remove` 실행
- [ ] 관련 브랜치 삭제 (선택적)

#### US-3.3: Branch 동기화

**As a** Agent
**I want to** main 브랜치 변경사항 동기화
**So that** 최신 코드 기반으로 작업

**Acceptance Criteria:**
- [ ] `git rebase main` 또는 `git merge main`
- [ ] 충돌 발생 시 Agent에게 알림
- [ ] 충돌 해결 가이드 제공

---

### Epic 4: PR 워크플로우

#### US-4.1: PR 자동 생성

**As a** Agent
**I want to** 작업 완료 후 PR 자동 생성
**So that** 코드 리뷰 프로세스 시작

**Acceptance Criteria:**
- [ ] `gh pr create` 실행
- [ ] PR 제목: Job 설명 기반
- [ ] PR 본문: 변경 요약, 테스트 방법
- [ ] 라벨: Agent 역할 기반

#### US-4.2: PR 의존성 머지

**As a** 시스템
**I want to** 의존성 순서로 PR 머지
**So that** 충돌 없이 통합

**Acceptance Criteria:**
- [ ] 의존하는 PR 먼저 머지 확인
- [ ] rebase 후 머지 시도
- [ ] 머지 실패 시 알림

#### US-4.3: PR 상태 추적

**As a** 사용자
**I want to** PR 상태 실시간 확인
**So that** 전체 진행 상황 파악

**Acceptance Criteria:**
- [ ] PR 목록 및 상태 표시
- [ ] CI/CD 상태 연동
- [ ] 머지 가능 여부 표시

---

### Epic 5: Agent 실행

#### US-5.1: Claude Code 세션 생성

**As a** 시스템
**I want to** Agent별 Claude Code 세션 생성
**So that** 독립적인 컨텍스트에서 작업

**Acceptance Criteria:**
- [ ] iTerm2 새 탭에서 세션 시작
- [ ] Worktree 디렉토리에서 실행
- [ ] Persona 프롬프트 주입
- [ ] 세션 ID 등록

#### US-5.2: 프롬프트 전송

**As a** 시스템
**I want to** Agent 세션에 작업 프롬프트 전송
**So that** 작업 시작 트리거

**Acceptance Criteria:**
- [ ] AppleScript로 입력 전송
- [ ] Job 내용 + Persona 컨텍스트 포함
- [ ] 작업 규칙(scope, skills) 명시

#### US-5.3: 작업 완료 감지

**As a** 시스템
**I want to** Agent 작업 완료 감지
**So that** 다음 Job 스케줄링

**Acceptance Criteria:**
- [ ] PR 생성 감지
- [ ] Agent idle 상태 감지
- [ ] Job 상태 업데이트

---

### Epic 6: 실시간 UI

#### US-6.1: 오피스 뷰 렌더링

**As a** 사용자
**I want to** 2D 오피스 형태로 Agent 확인
**So that** 직관적인 팀 현황 파악

**Acceptance Criteria:**
- [ ] PixiJS 기반 2D 렌더링
- [ ] 타일맵 배경 (오피스 바닥)
- [ ] 가구 오브젝트 (책상, 의자)
- [ ] Agent 아바타 표시

#### US-6.2: Agent 상태 실시간 표시

**As a** 사용자
**I want to** Agent 상태 실시간 확인
**So that** 누가 무슨 작업 중인지 파악

**Acceptance Criteria:**
- [ ] 상태별 아바타 색상/애니메이션
- [ ] 현재 작업 말풍선 표시
- [ ] 마지막 메시지 표시

#### US-6.3: Agent 간 대화 로그

**As a** 사용자
**I want to** Agent 간 대화 확인
**So that** 협업 과정 이해

**Acceptance Criteria:**
- [ ] 실시간 메시지 스트림
- [ ] 발신/수신 Agent 표시
- [ ] 메시지 타입별 스타일링

#### US-6.4: 작업 진행률 표시

**As a** 사용자
**I want to** 전체 작업 진행률 확인
**So that** 완료 예상 시간 파악

**Acceptance Criteria:**
- [ ] Job 목록 및 상태
- [ ] 진행률 바
- [ ] 의존성 그래프 시각화 (선택)

---

### Epic 7: 설정 및 커스터마이징

#### US-7.1: 커스텀 Persona 생성

**As a** 사용자
**I want to** 커스텀 Agent Persona 생성
**So that** 프로젝트에 맞는 역할 정의

**Acceptance Criteria:**
- [ ] Persona 생성 폼
- [ ] 역할, 성격, 담당 영역 입력
- [ ] 사용 가능 스킬 선택

#### US-7.2: Office 레이아웃 편집

**As a** 사용자
**I want to** 오피스 배치 커스터마이징
**So that** 원하는 형태의 오피스 구성

**Acceptance Criteria:**
- [ ] 드래그 앤 드롭 배치
- [ ] Agent 위치 저장
- [ ] 가구 추가/제거

---

## Technical Requirements

### TR-1: Git Worktree 격리

```bash
# Worktree 구조
/workspace/
├── main/                    # 메인 레포 (bare)
└── agent/
    ├── fe/                  # FE Agent worktree
    │   └── feature/fe-login
    ├── be/                  # BE Agent worktree
    │   └── feature/be-login
    └── qa/                  # QA Agent worktree
        └── feature/qa-login
```

### TR-2: Supabase Realtime

```typescript
// Agent 상태 동기화
supabase.channel('office:123')
  .on('presence', { event: 'sync' }, updateAgentPositions)
  .subscribe();

// Job 상태 변경
supabase.channel('jobs')
  .on('postgres_changes', {
    event: '*',
    table: 'job_queue'
  }, updateJobStatus)
  .subscribe();
```

### TR-3: Claude Code 세션 제어

```typescript
// semo-remote-client 통합
interface AgentCommand {
  command_type: 'create_session' | 'send_prompt' | 'get_output' | 'cancel' | 'terminate';
  payload: Record<string, unknown>;
}
```

---

## Non-Functional Requirements

### NFR-1: 성능

| 항목 | 요구사항 |
|------|----------|
| 작업 분해 응답 | < 3초 |
| Worktree 생성 | < 5초 |
| UI 렌더링 FPS | > 30 FPS |
| 실시간 지연 | < 1초 |

### NFR-2: 확장성

- 동시 Agent 수: 최대 10개
- 동시 Job 수: 최대 50개
- 동시 Office 수: 최대 10개

### NFR-3: 안정성

- Worktree 충돌 발생률: 0%
- 세션 복구 자동화
- Graceful shutdown

### NFR-4: 보안

- GitHub 토큰 안전한 저장
- RLS 기반 데이터 격리
- 민감 정보 로깅 방지

---

## Out of Scope

- GitHub Actions 통합 (CI/CD 자동 트리거)
- 코드 리뷰 자동화 (PR 리뷰어 역할)
- 비용 최적화 (토큰 사용량 관리)
- 모바일 UI
- 음성 인터페이스

---

## Dependencies

### 내부 의존성

| 의존성 | 설명 |
|--------|------|
| semo-remote | Supabase 스키마, 원격 통신 |
| semo-remote-client | iTerm2 세션 제어 |
| semo-skills | 공통 스킬 (write-code, create-pr 등) |

### 외부 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| Next.js | 14.x | 프론트엔드 프레임워크 |
| PixiJS | 8.x | 2D 렌더링 |
| Zustand | 4.x | 상태 관리 |
| Express | 4.x | 백엔드 API |
| simple-git | 3.x | Git 조작 |
| @supabase/supabase-js | 2.x | DB/Realtime |

---

## Risks

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|-----------|
| Git Worktree 디스크 사용량 | 높음 | 중 | 자동 정리, 얕은 클론 |
| Claude Code 세션 불안정 | 중 | 높음 | 재시도 로직, 세션 복구 |
| Realtime 연결 끊김 | 중 | 중 | 폴링 fallback |
| 복잡한 의존성 그래프 | 낮음 | 높음 | DAG 사이클 감지 |
| Agent 무한 루프 | 낮음 | 높음 | 타임아웃, Circuit Breaker |

---

## Glossary

| 용어 | 정의 |
|------|------|
| Office | GitHub Repo와 매핑된 가상 작업 공간 |
| Agent | 특정 역할을 수행하는 AI 작업자 |
| Persona | Agent의 성격, 전문 영역, 업무 스타일 |
| Worktree | Git worktree로 생성된 독립 작업 디렉토리 |
| Job | Agent가 수행할 단위 작업 |
| Task Decomposer | 자연어 요청을 Job으로 분해하는 컴포넌트 |
| Session | iTerm2에서 실행 중인 Claude Code 인스턴스 |
| DAG | Directed Acyclic Graph (의존성 그래프) |
