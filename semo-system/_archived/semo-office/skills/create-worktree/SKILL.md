# create-worktree Skill

> Agent용 Git Worktree 생성

## Purpose

특정 Agent를 위한 독립된 Git Worktree를 생성합니다.
각 Agent는 자신만의 물리적 작업 디렉토리에서 작업하여 충돌을 원천 방지합니다.

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | 메인 레포지토리 경로 |
| `agent_role` | string | Yes | Agent 역할 (FE, BE, QA 등) |
| `branch_name` | string | No | 브랜치명 (기본: feature/{role}-{timestamp}) |
| `task_id` | string | No | 연결된 Task ID |

## Execution Flow

```text
1. 입력 검증
   - repo_path 존재 확인
   - agent_role 유효성 확인
   ↓
2. Worktree 경로 결정
   - 기본 경로: {repo_path}/agent/{role}
   ↓
3. 브랜치 생성
   - git checkout -b {branch_name} 또는 기존 브랜치 사용
   ↓
4. Worktree 생성
   - git worktree add {path} {branch}
   ↓
5. DB 상태 업데이트
   - worktrees 테이블에 레코드 생성
   ↓
6. 결과 반환
```

## Commands

### Worktree 생성

```bash
# 1. 메인 레포로 이동
cd {repo_path}

# 2. 최신 main 가져오기
git fetch origin main

# 3. 새 브랜치 생성 (main 기반)
git branch {branch_name} origin/main 2>/dev/null || true

# 4. Worktree 생성
git worktree add agent/{role} {branch_name}

# 5. 결과 확인
ls -la agent/{role}
```

### 기존 Worktree 확인

```bash
git worktree list
```

## Output

```markdown
## Worktree 생성 완료

**Agent**: {agent_role}
**경로**: {worktree_path}
**브랜치**: {branch_name}
**상태**: idle

작업을 시작할 준비가 되었습니다.
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `already exists` | 이미 해당 경로에 worktree 존재 | `remove-worktree` 후 재생성 |
| `invalid branch` | 브랜치명이 유효하지 않음 | 브랜치명 형식 확인 |
| `not a git repository` | Git 레포가 아님 | repo_path 확인 |

## DB Update

```sql
INSERT INTO worktrees (office_id, agent_role, path, branch, status)
VALUES ('{office_id}', '{agent_role}', '{worktree_path}', '{branch_name}', 'idle');
```

## Example

```bash
# FE Agent용 Worktree 생성
skill:create-worktree(
  repo_path: "/workspace/my-project",
  agent_role: "FE",
  branch_name: "feature/fe-login-123"
)
```

## Related Skills

- `remove-worktree` - Worktree 제거
- `sync-branch` - main에서 rebase
- `create-pr` - PR 생성
