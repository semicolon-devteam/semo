# 02-Task Decomposer: 작업 분해 및 Job 생성

> 자연어 요청을 역할별 Job으로 분해하고 의존성 그래프 생성

---

## Overview

Task Decomposer는 사용자의 자연어 요청을 분석하여 적절한 Agent에게 할당할 Job으로 분해합니다. 프로젝트 컨텍스트를 파악하고, 역할별 작업을 생성하며, 의존성 관계를 추론합니다.

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

| 항목 | 요구사항 |
|------|----------|
| 응답 시간 | < 3초 |
| 정확도 | 적절한 역할 매칭 > 90% |
| 의존성 | 순환 의존성 0% |
