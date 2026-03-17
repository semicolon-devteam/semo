# sync-branch Skill

> Agent 브랜치를 main과 동기화 (rebase/merge)

## Purpose

Agent의 작업 브랜치를 main 브랜치의 최신 변경사항과 동기화합니다.
다른 Agent의 작업이 먼저 병합된 경우, 이 스킬로 최신 상태를 반영합니다.

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `worktree_path` | string | Yes | Worktree 경로 |
| `strategy` | string | No | 동기화 전략 (rebase/merge, 기본: rebase) |
| `source_branch` | string | No | 소스 브랜치 (기본: main) |
| `abort_on_conflict` | boolean | No | 충돌 시 중단 여부 (기본: true) |

## Execution Flow

```text
1. 입력 검증
   - Worktree 존재 확인
   - 작업 중인 변경사항 확인 (uncommitted)
   ↓
2. 원격 브랜치 fetch
   - git fetch origin {source_branch}
   ↓
3. 동기화 전략 실행
   - rebase: git rebase origin/{source_branch}
   - merge: git merge origin/{source_branch}
   ↓
4. 충돌 처리
   - 충돌 없음 → 성공
   - 충돌 발생 → abort 또는 수동 해결 안내
   ↓
5. 원격 업데이트 (선택)
   - rebase 후: git push --force-with-lease
   - merge 후: git push
   ↓
6. 결과 반환
```

## Commands

### 사전 확인

```bash
cd {worktree_path}

# 현재 브랜치 확인
git branch --show-current

# uncommitted 변경사항 확인
git status --porcelain
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Uncommitted changes detected"
  echo "Stashing changes before sync..."
  git stash push -m "auto-stash before sync"
fi
```

### Fetch

```bash
# 원격 최신화
git fetch origin {source_branch}

# 차이 확인
git log HEAD..origin/{source_branch} --oneline
```

### Rebase 전략 (기본)

```bash
# rebase 실행
git rebase origin/{source_branch}

# 성공 시
if [ $? -eq 0 ]; then
  echo "Rebase successful"
  git push --force-with-lease
else
  echo "Rebase failed - conflicts detected"
  if [ "{abort_on_conflict}" = "true" ]; then
    git rebase --abort
    exit 1
  fi
fi
```

### Merge 전략

```bash
# merge 실행
git merge origin/{source_branch} --no-edit

# 성공 시
if [ $? -eq 0 ]; then
  echo "Merge successful"
  git push
else
  echo "Merge failed - conflicts detected"
  if [ "{abort_on_conflict}" = "true" ]; then
    git merge --abort
    exit 1
  fi
fi
```

### Stash 복원

```bash
# stash 복원 (있는 경우)
stash_count=$(git stash list | grep "auto-stash before sync" | wc -l)
if [ $stash_count -gt 0 ]; then
  git stash pop
fi
```

## Sync Strategies

| 전략 | 장점 | 단점 | 권장 상황 |
|------|------|------|----------|
| **rebase** | 깔끔한 히스토리 | force push 필요 | 개인 브랜치 (기본) |
| **merge** | 히스토리 보존 | 머지 커밋 생성 | 공유 브랜치 |

## Conflict Handling

### 자동 중단 (기본)

```text
충돌 감지
    ↓
git rebase --abort (또는 git merge --abort)
    ↓
에러 메시지 반환:
- 충돌 파일 목록
- 수동 해결 명령어 안내
```

### 수동 해결 안내

```markdown
## 충돌 해결 필요

**충돌 파일**:
- `src/lib/auth.ts`
- `src/components/LoginForm.tsx`

**해결 방법**:
```bash
cd {worktree_path}

# 1. rebase 재시작
git rebase origin/main

# 2. 충돌 파일 수정

# 3. 해결 후 계속
git add .
git rebase --continue

# 4. 원격 업데이트
git push --force-with-lease
```
```

## Output

### 성공

```markdown
## 브랜치 동기화 완료

**브랜치**: feature/fe-login
**전략**: rebase
**소스**: origin/main

**적용된 커밋**:
- `abc1234` feat: Add user authentication API
- `def5678` fix: Handle token expiration

**상태**: 원격에 push 완료
```

### 이미 최신

```markdown
## 브랜치 동기화

**브랜치**: feature/fe-login
**상태**: 이미 최신 상태입니다.

main 브랜치와 차이가 없습니다.
```

### 충돌 발생

```markdown
## 브랜치 동기화 실패

**브랜치**: feature/fe-login
**전략**: rebase
**상태**: 충돌 발생 (자동 중단됨)

**충돌 파일**:
1. `src/lib/auth.ts` - 양쪽에서 수정됨
2. `src/types/user.ts` - 삭제/수정 충돌

**수동 해결 필요**:
```bash
cd agent/fe
git fetch origin main
git rebase origin/main
# 충돌 해결
git add .
git rebase --continue
git push --force-with-lease
```
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `uncommitted changes` | 스테이지 안된 변경 | stash 후 재시도 |
| `conflict` | 코드 충돌 | 수동 해결 필요 |
| `diverged` | 히스토리 분기 | force push 필요 |
| `not a worktree` | 잘못된 경로 | 경로 확인 |

## When to Use

### 자동 트리거

| 상황 | 트리거 |
|------|--------|
| 의존 PR 병합 후 | Job status 변경 시 |
| 작업 시작 전 | Worktree 초기화 시 |
| 충돌 감지 시 | merge-pr 실패 시 |

### 수동 호출

```bash
# Agent 작업 중 main 변경 반영
skill:sync-branch(
  worktree_path: "/workspace/project/agent/fe"
)

# merge 전략 사용
skill:sync-branch(
  worktree_path: "/workspace/project/agent/be",
  strategy: "merge"
)
```

## Example

```bash
# 기본 rebase 동기화
skill:sync-branch(
  worktree_path: "/workspace/my-project/agent/fe"
)

# 특정 브랜치에서 동기화 (develop)
skill:sync-branch(
  worktree_path: "/workspace/my-project/agent/be",
  source_branch: "develop",
  strategy: "merge"
)

# 충돌 시 중단하지 않음 (수동 해결)
skill:sync-branch(
  worktree_path: "/workspace/my-project/agent/qa",
  abort_on_conflict: false
)
```

## Related Skills

- `create-worktree` - Worktree 생성
- `merge-pr` - PR 병합
- `create-pr` - PR 생성
