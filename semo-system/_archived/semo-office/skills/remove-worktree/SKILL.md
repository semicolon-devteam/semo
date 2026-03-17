# remove-worktree Skill

> 작업 완료 후 Git Worktree 정리

## Purpose

Agent 작업 완료 후 Worktree를 안전하게 제거합니다.
디스크 공간을 확보하고 깔끔한 상태를 유지합니다.

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_path` | string | Yes | 메인 레포지토리 경로 |
| `agent_role` | string | Yes | Agent 역할 (FE, BE, QA 등) |
| `force` | boolean | No | 강제 삭제 여부 (기본: false) |
| `delete_branch` | boolean | No | 로컬 브랜치도 삭제 (기본: false) |

## Execution Flow

```text
1. 입력 검증
   - Worktree 존재 확인
   ↓
2. 상태 확인
   - 커밋되지 않은 변경사항 확인
   - PR 상태 확인 (머지 완료?)
   ↓
3. Worktree 제거
   - git worktree remove {path}
   ↓
4. (선택) 브랜치 삭제
   - git branch -d {branch}
   ↓
5. DB 상태 업데이트
   - worktrees 테이블에서 레코드 삭제
   ↓
6. 결과 반환
```

## Commands

### 상태 확인

```bash
cd {repo_path}

# Worktree 목록 확인
git worktree list

# 변경사항 확인 (worktree 내부)
cd agent/{role}
git status --porcelain
```

### Worktree 제거

```bash
cd {repo_path}

# 일반 제거 (변경사항 없을 때)
git worktree remove agent/{role}

# 강제 제거 (변경사항 있어도 삭제)
git worktree remove --force agent/{role}

# Worktree 정리 (고아 참조 제거)
git worktree prune
```

### 브랜치 삭제 (선택)

```bash
# 로컬 브랜치 삭제 (머지된 경우)
git branch -d {branch_name}

# 강제 삭제
git branch -D {branch_name}
```

## Output

### 성공

```markdown
## Worktree 제거 완료

**Agent**: {agent_role}
**경로**: {worktree_path}
**브랜치**: {branch_name} (삭제됨/유지됨)

Worktree가 정리되었습니다.
```

### 경고 (미커밋 변경사항)

```markdown
## Worktree 제거 실패

**원인**: 커밋되지 않은 변경사항이 있습니다.

**옵션**:
1. 변경사항을 커밋하고 PR 생성: `skill:create-pr`
2. 강제 삭제: `skill:remove-worktree --force`
3. 변경사항 확인: `git status`
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `not a valid worktree` | Worktree가 존재하지 않음 | 경로 확인 |
| `has changes` | 커밋되지 않은 변경사항 | 커밋 또는 `--force` |
| `branch not found` | 브랜치가 없음 | 브랜치명 확인 |

## Safety Checks

제거 전 확인 사항:
1. **PR 상태**: 머지되지 않은 PR이 있는가?
2. **변경사항**: 커밋되지 않은 변경이 있는가?
3. **의존성**: 다른 Job이 이 브랜치에 의존하는가?

```bash
# PR 상태 확인
gh pr list --head {branch_name}

# 변경사항 확인
cd agent/{role} && git diff --stat
```

## DB Update

```sql
DELETE FROM worktrees
WHERE office_id = '{office_id}'
  AND agent_role = '{agent_role}';
```

## Example

```bash
# FE Agent Worktree 제거 (브랜치 유지)
skill:remove-worktree(
  repo_path: "/workspace/my-project",
  agent_role: "FE"
)

# 강제 제거 + 브랜치 삭제
skill:remove-worktree(
  repo_path: "/workspace/my-project",
  agent_role: "FE",
  force: true,
  delete_branch: true
)
```

## Related Skills

- `create-worktree` - Worktree 생성
- `create-pr` - PR 생성
- `merge-pr` - PR 머지
