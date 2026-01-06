# 01-Core: Office, Agent, Persona Management

> Office 생성/관리, Agent 인스턴스, Persona 정의

---

## Overview

Semo Office의 기본 엔티티(Office, Agent, Persona)를 관리하는 CRUD 기능입니다.

---

## User Stories

### US-1.1: Office 생성

**As a** 개발자
**I want to** GitHub 레포지토리를 Office로 등록
**So that** AI Agent들이 해당 프로젝트에서 협업할 수 있음

**Acceptance Criteria:**
- [ ] GitHub org/repo 입력으로 Office 생성
- [ ] 로컬 레포 경로 자동 감지 또는 수동 입력
- [ ] 기본 Agent(FE, BE, QA) 자동 생성
- [ ] 기본 레이아웃 초기화

---

### US-1.2: Office 목록 조회

**As a** 사용자
**I want to** 등록된 Office 목록 확인
**So that** 작업할 Office를 선택할 수 있음

**Acceptance Criteria:**
- [ ] Office 카드 형태 표시
- [ ] 각 Office의 Agent 수, 진행 중 작업 수 표시
- [ ] 최근 활동 시간 표시

---

### US-1.3: Office 삭제

**As a** 사용자
**I want to** Office 삭제
**So that** 더 이상 사용하지 않는 리소스 정리

**Acceptance Criteria:**
- [ ] 삭제 확인 다이얼로그
- [ ] 관련 Worktree 자동 정리
- [ ] 진행 중 작업이 있으면 경고

---

### US-1.4: Agent 생성

**As a** 시스템
**I want to** Office에 Agent 인스턴스 생성
**So that** 작업을 수행할 수 있음

**Acceptance Criteria:**
- [ ] Persona 선택하여 Agent 생성
- [ ] 초기 위치 자동 배치
- [ ] Worktree 자동 연결 (선택적)

---

### US-1.5: Agent 상태 업데이트

**As a** 시스템
**I want to** Agent 상태(idle/working/blocked) 업데이트
**So that** UI에서 실시간 표시 가능

**Acceptance Criteria:**
- [ ] 상태 변경 시 DB 업데이트
- [ ] Realtime으로 UI에 브로드캐스트
- [ ] 현재 작업 설명 업데이트

---

### US-1.6: Persona 목록 조회

**As a** 사용자
**I want to** 사용 가능한 Persona 목록 조회
**So that** Agent에 적용할 역할 선택

**Acceptance Criteria:**
- [ ] 기본 Persona 목록 (PO, PM, FE, BE, QA, DevOps)
- [ ] 커스텀 Persona 포함
- [ ] 역할, 담당 영역, 스킬 표시

---

### US-1.7: 커스텀 Persona 생성

**As a** 사용자
**I want to** 커스텀 Persona 생성
**So that** 프로젝트에 맞는 역할 정의

**Acceptance Criteria:**
- [ ] 역할명, 이름, 성격 입력
- [ ] 담당 파일 패턴 지정
- [ ] 사용 가능 스킬 선택
- [ ] 아바타 설정 (선택적)

---

## API Endpoints

### Offices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices` | Office 목록 |
| POST | `/api/offices` | Office 생성 |
| GET | `/api/offices/:id` | Office 상세 |
| PATCH | `/api/offices/:id` | Office 수정 |
| DELETE | `/api/offices/:id` | Office 삭제 |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/agents` | Agent 목록 |
| POST | `/api/offices/:id/agents` | Agent 생성 |
| GET | `/api/offices/:id/agents/:agentId` | Agent 상세 |
| PATCH | `/api/offices/:id/agents/:agentId` | Agent 업데이트 |
| DELETE | `/api/offices/:id/agents/:agentId` | Agent 삭제 |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | Persona 목록 |
| POST | `/api/personas` | Persona 생성 |
| GET | `/api/personas/:id` | Persona 상세 |
| PUT | `/api/personas/:id` | Persona 수정 |
| DELETE | `/api/personas/:id` | Persona 삭제 |

---

## Data Models

### Office

```typescript
interface Office {
  id: string;
  name: string;
  github_org: string;
  github_repo: string;
  repo_path: string;
  layout: OfficeLayout;
  created_at: string;
  updated_at: string;
}

interface OfficeLayout {
  width: number;
  height: number;
  furniture: Furniture[];
  spawn_points: Position[];
}
```

### Agent

```typescript
interface OfficeAgent {
  id: string;
  office_id: string;
  persona_id: string;
  worktree_id?: string;
  session_id?: string;
  status: AgentStatus;
  position_x: number;
  position_y: number;
  current_task?: string;
  last_message?: string;
  updated_at: string;
}

type AgentStatus = 'idle' | 'working' | 'blocked';
```

### Persona

```typescript
interface AgentPersona {
  id: string;
  role: AgentRole;
  name: string;
  avatar_config: AvatarConfig;
  persona_prompt: string;
  scope_patterns: string[];
  core_skills: string[];
  knowledge_refs: string[];
  is_default: boolean;
  created_at: string;
}

type AgentRole = 'PO' | 'PM' | 'Architect' | 'FE' | 'BE' | 'QA' | 'DevOps';
```

---

## DB Schema

```sql
-- offices
CREATE TABLE offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  github_org VARCHAR(100) NOT NULL,
  github_repo VARCHAR(100) NOT NULL,
  repo_path VARCHAR(500),
  layout JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- agent_personas
CREATE TABLE agent_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  avatar_config JSONB DEFAULT '{}',
  persona_prompt TEXT NOT NULL,
  scope_patterns TEXT[] DEFAULT '{}',
  core_skills TEXT[] DEFAULT '{}',
  knowledge_refs TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- office_agents
CREATE TABLE office_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES agent_personas(id),
  worktree_id UUID REFERENCES worktrees(id),
  session_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'idle',
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  current_task TEXT,
  last_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Default Personas (Seed Data)

| Role | Name | Scope | Skills |
|------|------|-------|--------|
| PO | 박기획 | `docs/**`, `.github/ISSUE_TEMPLATE/**` | generate-spec |
| PM | 김피엠 | `README.md`, `.github/workflows/**` | planner, notify-slack |
| Architect | 이설계 | `**/types/**`, `lib/**` | planner, write-code |
| FE | 최프론트 | `src/app/**`, `src/components/**` | write-code, create-pr |
| BE | 정백엔드 | `src/api/**`, `src/lib/**` | write-code, create-pr |
| QA | 한큐에이 | `tests/**`, `e2e/**` | write-test, request-test |
| DevOps | 윤데봅스 | `package.json`, `docker/**` | deployer, circuit-breaker |
