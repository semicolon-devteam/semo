# 02-Task Decomposer: 작업 분해 및 Job 생성

> 자연어 요청을 역할별 Job으로 분해하고 의존성 그래프 생성

---

## Overview

Task Decomposer는 사용자의 자연어 요청을 분석하여 적절한 Agent에게 할당할 Job으로 분해합니다. 프로젝트 컨텍스트를 파악하고, 역할별 작업을 생성하며, 의존성 관계를 추론합니다.

> **Note**: Task Decomposer는 별도의 API 호출이 아닌, **Decomposer Agent 세션**으로 실행됩니다. Claude Max 구독 계정의 Claude Code CLI를 통해 분해 작업을 수행합니다.

### 실행 방식

```text
[사용자 요청]
      │
      ▼
┌─────────────────────────────┐
│  Decomposer Agent 세션      │  ← Claude Code CLI 세션
│  ├─ 프로젝트 컨텍스트 분석  │
│  ├─ 자연어 → Job 분해       │
│  └─ 의존성 그래프 생성      │
└─────────────────────────────┘
      │
      ▼
[DecompositionResult]
      │
      ▼
[Job Scheduler에 등록]
```

---

## User Stories

### US-2.1: 자연어 작업 요청

**As a** 개발자
**I want to** 자연어로 작업을 요청
**So that** 세부 구현을 신경 쓰지 않아도 됨

**Acceptance Criteria:**
- [ ] 채팅 형태의 입력 인터페이스
- [ ] "로그인 기능 구현해줘" 같은 자연어 처리
- [ ] 작업 분해 결과 미리보기
- [ ] 분해 결과 수정/승인 옵션

---

### US-2.2: 프로젝트 컨텍스트 분석

**As a** Task Decomposer
**I want to** 프로젝트 구조와 기술 스택 분석
**So that** 적절한 역할에 작업 할당 가능

**Acceptance Criteria:**
- [ ] package.json에서 기술 스택 파악
- [ ] 디렉토리 구조 분석 (src/, tests/ 등)
- [ ] 기존 패턴 감지 (컴포넌트 구조, API 구조)

---

### US-2.3: 역할별 Job 생성

**As a** Task Decomposer
**I want to** 작업을 역할별 Job으로 분해
**So that** 각 Agent가 전문 영역에서 작업

**Acceptance Criteria:**
- [ ] 요청 분석 후 필요한 역할 식별
- [ ] 역할별 구체적인 Job 설명 생성
- [ ] Job 우선순위 설정

---

### US-2.4: 의존성 그래프 생성

**As a** Task Decomposer
**I want to** Job 간 의존성 관계 추론
**So that** 올바른 순서로 작업 실행

**Acceptance Criteria:**
- [ ] 의존성 관계 자동 추론
- [ ] DAG (Directed Acyclic Graph) 생성
- [ ] 순환 의존성 감지 및 경고

---

### US-2.5: Persona 매칭

**As a** Task Decomposer
**I want to** Job에 적합한 Persona 매칭
**So that** 전문성에 맞는 작업 수행

**Acceptance Criteria:**
- [ ] Job 내용과 Persona scope_patterns 매칭
- [ ] 여러 Persona 적합 시 우선순위 결정
- [ ] 커스텀 Persona 고려

---

### US-2.6: Job 상태 관리

**As a** Job Scheduler
**I want to** Job 상태를 의존성에 따라 관리
**So that** 올바른 순서로 실행

**Acceptance Criteria:**
- [ ] 의존성 없는 Job → ready 상태
- [ ] 의존성 있는 Job → pending 상태
- [ ] 의존 Job 완료 시 → ready로 전환

---

### US-2.7: Job Scheduler 연동

> "분해된 Job을 Job Scheduler에 등록하여 실행을 위임한다"

**AC**:

- [ ] DecompositionResult를 Job Scheduler에 전달
- [ ] 각 Job을 job_queue 테이블에 INSERT
- [ ] 의존성 그래프 기반 초기 상태 설정
- [ ] Scheduler 시작 트리거
- [ ] 실행 결과 콜백 수신

**연동 흐름**:

```text
[Task Decomposer]
       │
       │ DecompositionResult
       │ (jobs, dependencyGraph)
       ▼
┌─────────────────┐
│  Job Scheduler  │
│  ├─ enqueue()   │ ← 각 Job INSERT
│  ├─ start()     │ ← 스케줄러 시작
│  └─ onComplete()│ ← 완료 콜백
└─────────────────┘
       │
       ▼
[Session Execution]
```

**구현 코드**:

```typescript
class TaskDecomposer {
  private sessionManager: SessionManager;
  private decomposerWorktree: string;  // Decomposer 전용 Worktree

  async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
    // 1. Decomposer Agent 세션 생성 (없으면)
    const session = await this.getOrCreateDecomposerSession(request.officeId);

    // 2. 분해 프롬프트 전송
    const prompt = this.buildDecompositionPrompt(request);
    await this.sessionManager.execute(session.id, prompt);

    // 3. 출력에서 결과 파싱 (JSON 형식)
    const output = await this.waitForCompletion(session.id);
    const result = this.parseDecompositionResult(output);

    // 4. Job Scheduler에 등록
    await this.scheduler.enqueueJobs(request.officeId, result.jobs);

    // 5. 의존성 설정
    for (const edge of result.dependencyGraph) {
      await this.scheduler.setDependency(edge.from, edge.to);
    }

    // 6. 스케줄러 시작
    await this.scheduler.start(request.officeId);

    return result;
  }

  private buildDecompositionPrompt(request: DecompositionRequest): string {
    return `
작업 분해를 수행합니다.

## 요청
${request.task}

## 프로젝트 컨텍스트
${request.context?.relatedFiles?.join(', ') || '없음'}

## 출력 형식
JSON 형식으로 출력하세요:
\`\`\`json
{
  "summary": "작업 요약",
  "jobs": [...],
  "dependencyGraph": [...],
  "executionOrder": [...]
}
\`\`\`

작업 완료 후 [SEMO:DECOMPOSE_DONE] 마커를 출력하세요.
`;
  }

  private async waitForCompletion(sessionId: string): Promise<string> {
    // [SEMO:DECOMPOSE_DONE] 패턴 감지까지 대기
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const output = await this.sessionManager.getOutput(sessionId);
        if (output.includes('[SEMO:DECOMPOSE_DONE]')) {
          clearInterval(interval);
          resolve(output);
        }
      }, 1000);
    });
  }
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/offices/:id/tasks` | 작업 요청 (자연어) |
| GET | `/api/offices/:id/jobs` | Job 목록 |
| GET | `/api/offices/:id/jobs/:jobId` | Job 상세 |
| PATCH | `/api/offices/:id/jobs/:jobId` | Job 상태 업데이트 |

---

## Data Models

### DecompositionRequest

```typescript
interface DecompositionRequest {
  officeId: string;
  task: string;  // 자연어 요청
  context?: {
    relatedFiles?: string[];
    constraints?: string[];
  };
}
```

### DecompositionResult

```typescript
interface DecompositionResult {
  summary: string;
  jobs: DecomposedJob[];
  dependencyGraph: DependencyEdge[];
  executionOrder: string[][];  // 병렬 실행 그룹
  estimatedAgents: number;
}

interface DecomposedJob {
  id: string;
  role: AgentRole;
  description: string;
  priority: number;
  estimatedFiles: string[];
  requiredSkills: string[];
}

interface DependencyEdge {
  from: string;  // Job ID
  to: string;    // Job ID
  reason: string;
}
```

### Job

```typescript
interface Job {
  id: string;
  office_id: string;
  agent_id?: string;
  worktree_id?: string;
  description: string;
  status: JobStatus;
  depends_on: string[];
  pr_number?: number;
  branch_name?: string;
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

type JobStatus = 'pending' | 'ready' | 'processing' | 'done' | 'failed';
```

---

## DB Schema

```sql
-- job_queue
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES office_agents(id),
  worktree_id UUID REFERENCES worktrees(id),
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  depends_on UUID[] DEFAULT '{}',
  pr_number INT,
  branch_name VARCHAR(100),
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_job_queue_office ON job_queue(office_id);
CREATE INDEX idx_job_queue_status ON job_queue(status);
```

---

## Decomposition Logic

### 1. 프로젝트 컨텍스트 분석

```typescript
interface ProjectContext {
  techStack: string[];        // ['next.js', 'typescript', 'tailwind']
  structure: DirectoryInfo[];  // 디렉토리 구조
  patterns: {
    components: string;       // 'src/components/'
    api: string;              // 'src/api/'
    tests: string;            // 'tests/'
  };
}

async function analyzeProject(repoPath: string): Promise<ProjectContext> {
  // 1. package.json 분석
  // 2. 디렉토리 구조 분석
  // 3. 기존 패턴 감지
}
```

### 2. 역할 매핑 규칙

| 요청 키워드 | 역할 | 우선순위 |
|-------------|------|----------|
| UI, 컴포넌트, 페이지, 폼 | FE | 1 |
| API, 서버, DB, 백엔드 | BE | 1 |
| 테스트, 검증 | QA | 2 (FE/BE 후) |
| 기획, 스펙, 요구사항 | PO | 0 (먼저) |
| 배포, CI/CD, 인프라 | DevOps | 3 (마지막) |

### 3. 의존성 추론 규칙

```typescript
const dependencyRules = [
  // QA는 FE, BE 완료 후
  { if: 'QA', dependsOn: ['FE', 'BE'] },
  // FE는 BE API 필요할 수 있음
  { if: 'FE', mayDependOn: ['BE'], when: 'API 연동' },
  // DevOps는 모든 코드 완료 후
  { if: 'DevOps', dependsOn: ['FE', 'BE', 'QA'] },
];
```

---

## Example

### Input
```json
{
  "task": "로그인 기능 구현해줘"
}
```

### Output
```json
{
  "summary": "로그인 - create",
  "jobs": [
    {
      "id": "job-fe-001",
      "role": "FE",
      "description": "로그인 UI 구현 - 이메일/비밀번호 폼, 유효성 검사, 에러 표시",
      "priority": 1,
      "estimatedFiles": ["src/app/login/page.tsx", "src/components/LoginForm.tsx"],
      "requiredSkills": ["write-code", "create-pr"]
    },
    {
      "id": "job-be-002",
      "role": "BE",
      "description": "로그인 API 구현 - POST /api/auth/login, JWT 토큰 발급",
      "priority": 1,
      "estimatedFiles": ["src/api/auth/login.ts", "src/lib/jwt.ts"],
      "requiredSkills": ["write-code", "create-pr"]
    },
    {
      "id": "job-qa-003",
      "role": "QA",
      "description": "로그인 테스트 작성 - 유닛 테스트, E2E 테스트",
      "priority": 2,
      "estimatedFiles": ["tests/auth/login.test.ts", "e2e/login.spec.ts"],
      "requiredSkills": ["write-test"]
    }
  ],
  "dependencyGraph": [
    { "from": "job-fe-001", "to": "job-qa-003", "reason": "UI 완료 후 테스트" },
    { "from": "job-be-002", "to": "job-qa-003", "reason": "API 완료 후 테스트" }
  ],
  "executionOrder": [
    ["job-fe-001", "job-be-002"],
    ["job-qa-003"]
  ],
  "estimatedAgents": 3
}
```

---

## Non-Functional Requirements

| 항목         | 요구사항                |
|--------------|-------------------------|
| 응답 시간    | < 30초 (CLI 세션 기반)  |
| 정확도       | 적절한 역할 매칭 > 90%  |
| 의존성       | 순환 의존성 0%          |

---

## Decomposer Agent Persona

Task Decomposer는 특수한 Agent로, Office당 하나만 존재합니다.

```typescript
const decomposerPersona: AgentPersona = {
  role: 'Decomposer',
  name: '김분해',
  persona_prompt: `
당신은 작업 분해 전문가입니다.
사용자의 자연어 요청을 분석하여 역할별 Job으로 분해합니다.

## 역할
- 프로젝트 구조와 기술 스택 파악
- 요청을 FE, BE, QA 등 역할별 작업으로 분해
- Job 간 의존성 관계 추론
- 실행 순서 최적화

## 출력 규칙
- 반드시 JSON 형식으로 출력
- 완료 시 [SEMO:DECOMPOSE_DONE] 마커 출력
- 순환 의존성 생성 금지
`,
  scope_patterns: ['*'],  // 모든 파일 접근 가능 (분석용)
  core_skills: ['planner'],
  is_default: true,
};
```

### Decomposer 세션 관리

| 항목              | 설정                          |
|-------------------|-------------------------------|
| 세션 수           | Office당 1개                  |
| 생명주기          | Office 활성화 시 생성, 유지   |
| Worktree          | 메인 레포 (Worktree 미사용)   |
| 타임아웃          | 60초 (분해 작업)              |
