# merge-pr Skill

> PR을 의존성 순서에 따라 안전하게 병합

## Purpose

Agent들이 생성한 PR을 의존성 순서에 따라 main 브랜치로 병합합니다.
충돌 감지, rebase, 병합 순서 결정을 자동으로 처리합니다.

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `office_id` | string | Yes | Office ID |
| `pr_number` | number | No | 특정 PR 번호 (없으면 ready 상태 전체) |
| `strategy` | string | No | 병합 전략 (squash/merge/rebase, 기본: squash) |
| `auto_rebase` | boolean | No | 충돌 시 자동 rebase (기본: true) |

## Execution Flow

```text
1. 병합 대상 PR 조회
   - pr_number 지정 시: 해당 PR만
   - 미지정 시: status='ready' 인 모든 job의 PR
   ↓
2. 의존성 그래프 분석
   - job_queue.depends_on 조회
   - 토폴로지 정렬로 병합 순서 결정
   ↓
3. 순차 병합 실행
   - 각 PR에 대해:
     a. 충돌 확인
     b. 필요시 rebase
     c. gh pr merge 실행
   ↓
4. 후속 처리
   - Worktree 정리 트리거
   - 다음 Job 상태 업데이트 (pending → ready)
   ↓
5. 결과 반환
```

## Commands

### PR 상태 확인

```bash
# PR 머지 가능 여부 확인
gh pr view {pr_number} --json mergeable,mergeStateStatus

# 예시 응답
# { "mergeable": "MERGEABLE", "mergeStateStatus": "CLEAN" }
```

### 의존성 순서 조회 (DB)

```sql
-- 의존성을 고려한 병합 순서 조회
WITH RECURSIVE dep_order AS (
  -- 의존성 없는 Job (시작점)
  SELECT id, pr_number, branch_name, depends_on, 0 as depth
  FROM job_queue
  WHERE office_id = '{office_id}'
    AND status = 'done'
    AND pr_number IS NOT NULL
    AND (depends_on IS NULL OR depends_on = '{}')

  UNION ALL

  -- 의존성이 해결된 Job
  SELECT j.id, j.pr_number, j.branch_name, j.depends_on, d.depth + 1
  FROM job_queue j
  JOIN dep_order d ON j.depends_on @> ARRAY[d.id]
  WHERE j.office_id = '{office_id}'
    AND j.status = 'done'
    AND j.pr_number IS NOT NULL
)
SELECT DISTINCT ON (id) * FROM dep_order
ORDER BY id, depth;
```

### Rebase 실행

```bash
cd {worktree_path}

# main 최신화
git fetch origin main

# rebase 시도
git rebase origin/main

# 충돌 시
if [ $? -ne 0 ]; then
  echo "CONFLICT: Manual resolution required"
  git rebase --abort
  exit 1
fi

# Force push (rebase 후)
git push --force-with-lease
```

### PR 병합

```bash
# Squash merge (기본)
gh pr merge {pr_number} --squash --delete-branch

# Merge commit
gh pr merge {pr_number} --merge --delete-branch

# Rebase merge
gh pr merge {pr_number} --rebase --delete-branch
```

## Merge Strategies

| 전략 | 명령어 | 용도 |
|------|--------|------|
| **squash** | `--squash` | 커밋 히스토리 정리 (기본) |
| **merge** | `--merge` | 브랜치 히스토리 보존 |
| **rebase** | `--rebase` | 선형 히스토리 |

## Dependency Resolution

### 토폴로지 정렬 알고리즘

```text
Input:
  PR #42 (FE) depends on: []
  PR #43 (BE) depends on: []
  PR #44 (QA) depends on: [PR #42, PR #43]

Process:
  1. In-degree 계산
     - PR #42: 0 (의존성 없음)
     - PR #43: 0 (의존성 없음)
     - PR #44: 2 (FE, BE 대기)

  2. In-degree 0인 PR 먼저 처리
     - PR #42 병합 → PR #44 in-degree: 1
     - PR #43 병합 → PR #44 in-degree: 0

  3. PR #44 처리 가능

Output: [PR #42, PR #43, PR #44] 또는 [PR #43, PR #42, PR #44]
```

## Output

### 성공

```markdown
## PR 병합 완료

**병합된 PR**:
1. PR #42 (feature/fe-login) → main ✅
2. PR #43 (feature/be-login) → main ✅
3. PR #44 (feature/qa-login) → main ✅

**병합 전략**: squash
**총 3개 PR 병합됨**

다음 단계: Worktree 정리 및 QA 트리거
```

### 부분 성공 (충돌 발생)

```markdown
## PR 병합 부분 완료

**병합 성공**:
- PR #42 (feature/fe-login) → main ✅

**병합 실패 (충돌)**:
- PR #43 (feature/be-login) ❌
  - 충돌 파일: `src/lib/auth.ts`
  - 해결 필요: 수동 rebase 또는 충돌 해결

**권장 조치**:
```bash
cd agent/be
git fetch origin main
git rebase origin/main
# 충돌 해결 후
git push --force-with-lease
```
```

### 실패 (의존성 미해결)

```markdown
## PR 병합 불가

**원인**: 의존성 PR이 아직 병합되지 않음

**PR #44 (QA)** 대기 중:
- ⏳ PR #42 (FE) - 진행 중
- ⏳ PR #43 (BE) - 리뷰 대기

의존성 PR이 먼저 병합되어야 합니다.
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `not mergeable` | 충돌 존재 | rebase 또는 수동 해결 |
| `blocked` | 리뷰 미완료 | 리뷰 승인 필요 |
| `dependency not met` | 의존 PR 미병합 | 의존 PR 먼저 병합 |
| `branch protected` | 보호 브랜치 규칙 | 규칙 확인 또는 관리자 승인 |

## DB Update

```sql
-- PR 병합 후 Job 상태 업데이트
UPDATE job_queue
SET status = 'merged', completed_at = NOW()
WHERE pr_number = {pr_number};

-- 의존성 해결된 Job들 ready로 전환
UPDATE job_queue
SET status = 'ready'
WHERE office_id = '{office_id}'
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM job_queue dep
    WHERE dep.id = ANY(job_queue.depends_on)
      AND dep.status != 'merged'
  );
```

## Post-Merge Actions

```text
1. Worktree 정리 트리거
   → skill:remove-worktree 호출

2. 다음 Job 활성화
   → 의존성 해결된 Job status='ready'로 변경

3. 알림 전송 (선택)
   → Slack 알림 또는 Agent 메시지
```

## Example

```bash
# 특정 PR 병합
skill:merge-pr(
  office_id: "office-123",
  pr_number: 42
)

# Ready 상태 전체 병합
skill:merge-pr(
  office_id: "office-123",
  strategy: "squash",
  auto_rebase: true
)
```

## Related Skills

- `create-pr` - PR 생성
- `sync-branch` - 브랜치 동기화
- `remove-worktree` - Worktree 정리
