# /SEMO-workflow:greenfield

BMad Method Greenfield Workflow를 시작합니다.

## Purpose

새로운 프로젝트를 처음부터 구축하는 4-Phase 워크플로우입니다.

## Tech Stack

이 워크플로우는 **Vercel + Supabase** 기반 프로젝트 개발을 위해 설계되었습니다.

| 항목 | 기술 |
| ---- | ---- |
| **Frontend** | Next.js 14+ (App Router) |
| **Backend** | Supabase (PostgreSQL + RPC) |
| **Hosting** | Vercel |
| **State** | TanStack Query |
| **Styling** | Tailwind CSS |
| **Testing** | Vitest + React Testing Library |

```
Phase 1: Discovery (Optional) - 아이디어 발굴 및 분석
Phase 2: Planning (Required) - PRD/Epic 생성 및 UX 설계
Phase 3: Solutioning (Required) - 아키텍처 및 명세 작성
Phase 4: Implementation (Required) - 스프린트 기반 개발
```

## Usage

```
/SEMO-workflow:greenfield
```

## Workflow Nodes

### Phase 1: Discovery (Optional)

| Node | Name | Agent | Skill |
|------|------|-------|-------|
| D0 | Include Discovery? | - | (decision) |
| D1 | Ideate | Analyst | `ideate` |

### Phase 1.5: Setup (Required)

| Node | Name | Agent | Skill |
|------|------|-------|-------|
| P0 | Setup Environment | DevOps | `setup-environment` |

> **P0 노드는 Discovery 완료 후 자동 실행됩니다.**
>
> 이 단계에서 Vercel/Supabase CLI 설정 및 환경변수를 구성합니다:
>
> - Vercel CLI 로그인 및 프로젝트 연결
> - Supabase CLI 로그인 및 프로젝트 연결
> - `.env.local` 환경변수 설정
>   - `NEXT_PUBLIC_SUPABASE_URL`
>   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>   - `SUPABASE_SERVICE_ROLE_KEY`

### Phase 2: Planning

| Node | Name | Agent | Skill |
|------|------|-------|-------|
| P1 | Create PRD/Epic | PM | `create-epic` |
| P2 | Has UI? | - | (decision) |
| P3 | Design User Flow | UX Designer | `design-user-flow` |
| P4 | Generate Mockup | UX Designer | `generate-mockup` |

### Phase 3: Solutioning

| Node | Name | Agent | Skill |
|------|------|-------|-------|
| S1 | Scaffold Domain | Architect | `scaffold-domain` |
| S2 | Validate Architecture? | - | (decision) |
| S3 | Validate Architecture | Architect | `validate-architecture` |
| S4 | Generate Spec | PM | `generate-spec` |
| S5 | Design Tests? | - | (decision) |
| S6 | Design Tests | QA | `design-tests` |
| S7 | Implementation Ready | - | (gateway) |

### Phase 4: Implementation

| Node | Name | Agent | Skill |
|------|------|-------|-------|
| I1 | Sprint Plan | SM | `create-sprint` |
| I2 | Start Task | SM | `start-task` |
| I3 | Validate Story? | - | (decision) |
| I4 | Review Task | SM | `review-task` |
| I5 | Write Code | DEV | `write-code` |
| I6 | Code Review | DEV | `run-code-review` |
| I7 | Review Pass? | - | (decision) |
| I8 | More Stories? | - | (decision) |
| I9 | Close Sprint | SM | `close-sprint` |
| I10 | More Epics? | - | (decision) |
| END | End | - | (gateway) |

## Execution

이 커맨드가 호출되면:

1. **`skill:workflow-start`** 호출
   - workflow_command: "greenfield"
   - 사용자에게 프로젝트 이름 입력 요청
   - DB에 workflow_instances 레코드 생성
   - 첫 번째 노드(D0)로 이동

2. **노드 순차 실행**
   - Task 노드: 해당 스킬 실행
   - Decision 노드: 사용자에게 옵션 제시
   - Gateway 노드: 다음 노드로 자동 이동

3. **진행도 추적**
   - 각 노드 완료 시 `workflow_node_executions`에 기록
   - `current_node_id` 업데이트
   - `workflow-progress` 스킬로 진행 현황 확인 가능

## DB Schema

### 테이블 구조

```text
semo.workflow_definitions
  └── greenfield 워크플로우 정의 (command_name='greenfield')

semo.workflow_nodes (24개 노드)
  ├── skill_id (UUID FK → skills.id)
  ├── agent_id (UUID FK → agents.id)
  └── decision_config (JSONB)

semo.workflow_instances
  └── 실행 중인 워크플로우 인스턴스

semo.workflow_node_executions
  └── 노드별 실행 기록
```

### FK 기반 조회

```sql
-- 노드 정보 조회 시 View 사용 권장
SELECT node_key, name, skill_name, agent_name, phase
FROM semo.v_workflow_nodes
WHERE workflow_definition_id = (
  SELECT id FROM semo.workflow_definitions
  WHERE command_name = 'greenfield'
)
ORDER BY install_order;
```

## Related Commands

- `/SEMO-workflow:brownfield` - 레거시 개선 워크플로우 (TODO)
- `/SEMO-workflow:project-audit` - 프로젝트 감사 워크플로우 (TODO)

## Related Skills

- `workflow-start` - 워크플로우 인스턴스 생성
- `workflow-progress` - 진행 상황 조회
- `workflow-resume` - 중단된 워크플로우 재개

---

> **실행**: `skill:workflow-start` 호출 (workflow_command: "greenfield")
