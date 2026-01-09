# 03-Worktree: Git Worktree Management

> Agent별 독립된 Git 작업 공간 생성 및 관리

---

## Overview

Git Worktree를 사용하여 각 Agent가 물리적으로 격리된 작업 공간에서 작업합니다. 이를 통해 여러 Agent가 동시에 작업해도 충돌이 발생하지 않습니다.

---

## User Stories

### US-3.1: Worktree 생성

**As a** Agent
**I want to** 작업용 Worktree 생성
**So that** 다른 Agent와 독립적으로 작업

**Acceptance Criteria:**
- [ ] `git worktree add` 실행
- [ ] 브랜치명 규칙: `feature/{role}-{task-id}`
- [ ] Worktree 경로: `/workspace/agent/{role}/`
- [ ] 기본 브랜치에서 분기

---

### US-3.2: Worktree 목록 조회

**As a** 시스템
**I want to** Office의 Worktree 목록 조회
**So that** 리소스 상태 파악

**Acceptance Criteria:**
- [ ] Office별 Worktree 목록 반환
- [ ] 각 Worktree의 상태, 브랜치, 경로 표시
- [ ] 연결된 Agent 정보 포함

---

### US-3.3: Worktree 정리

**As a** 시스템
**I want to** 작업 완료된 Worktree 정리
**So that** 디스크 공간 확보

**Acceptance Criteria:**
- [ ] PR 머지 후 자동 정리
- [ ] `git worktree remove` 실행
- [ ] 관련 브랜치 삭제 (선택적)
- [ ] DB 상태 업데이트

---

### US-3.4: Branch 동기화

**As a** Agent
**I want to** main 브랜치 변경사항 동기화
**So that** 최신 코드 기반으로 작업

**Acceptance Criteria:**
- [ ] `git fetch` + `git rebase main` 또는 `git merge main`
- [ ] 충돌 발생 시 Agent에게 알림
- [ ] 충돌 해결 가이드 제공

---

## Worktree Structure

```
/workspace/
├── main/                    # 메인 레포 (또는 bare)
├── agent/
│   ├── fe/                  # FE Agent worktree
│   │   ├── .git             # worktree 링크
│   │   ├── src/app/         # 담당 영역
│   │   └── src/components/
│   ├── be/                  # BE Agent worktree
│   │   ├── .git
│   │   ├── src/api/
│   │   └── src/lib/
│   └── qa/                  # QA Agent worktree
│       ├── .git
│       ├── tests/
│       └── e2e/
```

---

## Data Models

### Worktree

```typescript
interface Worktree {
  id: string;
  office_id: string;
  agent_role: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  created_at: string;
  updated_at: string;
}

type WorktreeStatus = 'idle' | 'working' | 'syncing' | 'error';
```

---

## DB Schema

```sql
-- worktrees
CREATE TABLE worktrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  agent_role VARCHAR(50) NOT NULL,
  path VARCHAR(500) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'idle',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(office_id, agent_role)
);

CREATE INDEX idx_worktrees_office ON worktrees(office_id);
```

---

## Git Operations

### Worktree 생성

```bash
# 1. main에서 새 브랜치 생성
git branch feature/fe-login main

# 2. Worktree 추가
git worktree add /workspace/agent/fe feature/fe-login

# 3. (선택) 얕은 클론 적용
git -C /workspace/agent/fe fetch --depth=1
```

### Worktree 삭제

```bash
# 1. Worktree 제거
git worktree remove /workspace/agent/fe

# 2. (선택) 브랜치 삭제
git branch -D feature/fe-login

# 3. Worktree 정리
git worktree prune
```

### Branch 동기화

```bash
# 1. Fetch
git -C /workspace/agent/fe fetch origin main

# 2. Rebase (권장) 또는 Merge
git -C /workspace/agent/fe rebase origin/main
# 또는
git -C /workspace/agent/fe merge origin/main
```

---

## Skills (semo-office)

### create-worktree

```markdown
# create-worktree

Agent용 Git Worktree를 생성합니다.

## Input
- office_id: Office UUID
- agent_role: 역할 (FE, BE, QA 등)
- task_id: 작업 식별자 (브랜치명에 사용)

## Output
- worktree_path: 생성된 Worktree 경로
- branch_name: 생성된 브랜치명

## Process
1. 브랜치명 생성: feature/{role}-{task_id}
2. git worktree add 실행
3. DB에 Worktree 등록
```

### remove-worktree

```markdown
# remove-worktree

작업 완료된 Worktree를 정리합니다.

## Input
- worktree_id: Worktree UUID

## Process
1. git worktree remove 실행
2. (선택) 브랜치 삭제
3. DB 상태 업데이트
```

### sync-branch

```markdown
# sync-branch

main 브랜치 변경사항을 Worktree에 동기화합니다.

## Input
- worktree_id: Worktree UUID
- strategy: 'rebase' | 'merge' (기본: rebase)

## Process
1. git fetch origin main
2. git rebase/merge origin/main
3. 충돌 시 알림
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/worktrees` | Worktree 목록 |
| POST | `/api/offices/:id/worktrees` | Worktree 생성 |
| DELETE | `/api/offices/:id/worktrees/:wtId` | Worktree 삭제 |
| POST | `/api/offices/:id/worktrees/:wtId/sync` | Branch 동기화 |

---

## Non-Functional Requirements

| 항목 | 요구사항 |
|------|----------|
| 생성 시간 | < 5초 (얕은 클론 시) |
| 디스크 사용 | 자동 정리로 관리 |
| 충돌 처리 | 자동 감지 + 알림 |
