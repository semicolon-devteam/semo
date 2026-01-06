# 05-PR Workflow: PR 생성 및 병합

> Agent 작업 완료 후 PR 생성, 의존성 순서 병합, 자동 정리

---

## Overview

각 Agent는 작업 완료 시 자신의 Worktree 브랜치에서 PR을 생성합니다.
PR은 Job 의존성 순서에 따라 병합되며, 병합 후 Worktree는 자동으로 정리됩니다.

### 워크플로우

```text
[Agent 작업 완료]
       │
       ▼
┌─────────────────┐
│  PR 생성        │ ← create-pr Skill
│  (gh pr create) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PR 대기        │ ← depends_on Job들의 PR 머지 대기
│  (status check) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PR 머지        │ ← merge-pr Skill
│  (gh pr merge)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Worktree 정리  │ ← remove-worktree Skill
│  (cleanup)      │
└─────────────────┘
```

---

## User Stories

### US-PR01: PR 자동 생성

> "Agent가 작업을 완료하면 해당 브랜치에서 자동으로 PR을 생성한다"

**AC**:
- Job 완료 시 자동 PR 생성
- PR 제목: `[{role}] {job_description}`
- PR 본문: Job 상세, 변경 파일 목록
- PR 번호를 job_queue에 기록

### US-PR02: PR 라벨링

> "PR에 역할 및 Job 정보 라벨을 자동 부여한다"

**AC**:
- 역할 라벨: `agent:fe`, `agent:be`, `agent:qa`
- 상태 라벨: `auto-generated`, `ready-to-merge`
- Job ID 라벨: `job:{job_id}`

### US-PR03: 의존성 순서 병합

> "PR은 Job 의존성 순서에 따라 병합된다"

**AC**:
- depends_on이 없는 PR부터 병합
- 선행 PR 머지 완료 후 후속 PR 병합
- 머지 충돌 시 rebase 자동 시도

### US-PR04: PR 상태 추적

> "PR의 상태를 실시간으로 추적하고 UI에 반영한다"

**AC**:
- GitHub Webhook 또는 Polling으로 상태 확인
- PR 상태: draft, open, merged, closed
- 상태 변경 시 Realtime 브로드캐스트

### US-PR05: 머지 후 정리

> "PR 머지 후 Worktree와 브랜치를 자동으로 정리한다"

**AC**:
- PR 머지 시 자동 Worktree 삭제
- 원격 브랜치 삭제
- job_queue 상태 업데이트 (done)

---

## Data Models

### PRInfo

```typescript
interface PRInfo {
  pr_number: number;
  job_id: string;
  branch: string;
  title: string;
  status: PRStatus;
  url: string;
  created_at: string;
  merged_at?: string;
}

type PRStatus =
  | 'draft'     // 초안
  | 'open'      // 열림 (리뷰 대기)
  | 'approved'  // 승인됨
  | 'merged'    // 병합됨
  | 'closed';   // 닫힘 (미병합)
```

### MergeQueue

```typescript
interface MergeQueueItem {
  job_id: string;
  pr_number: number;
  depends_on: string[];  // 선행 job_id 목록
  can_merge: boolean;    // 선행 PR 모두 머지됨
  priority: number;
}
```

---

## Skills

### create-pr Skill

```markdown
# create-pr Skill

## 입력
- worktree_path: Worktree 경로
- job: Job 정보
- persona: Agent 페르소나

## 실행
1. git add -A (변경사항 스테이징)
2. git commit -m "{commit_message}"
3. gh pr create --title "{title}" --body "{body}" --label "{labels}"
4. PR 번호 반환

## 출력
- pr_number: 생성된 PR 번호
- pr_url: PR URL
```

### merge-pr Skill

```markdown
# merge-pr Skill

## 입력
- pr_number: PR 번호
- merge_method: 'squash' | 'merge' | 'rebase'

## 실행
1. 의존성 PR 머지 여부 확인
2. 머지 충돌 시 rebase 시도
3. gh pr merge {pr_number} --{method}
4. 결과 반환

## 출력
- success: 병합 성공 여부
- merged_sha: 머지 커밋 SHA
```

### sync-branch Skill

```markdown
# sync-branch Skill

## 입력
- worktree_path: Worktree 경로
- strategy: 'rebase' | 'merge'

## 실행
1. git fetch origin main
2. git rebase origin/main (또는 merge)
3. 충돌 발생 시 오류 반환

## 출력
- success: 동기화 성공 여부
- conflicts: 충돌 파일 목록 (있는 경우)
```

---

## Merge Strategy

### 의존성 기반 머지 순서

```text
Job Graph:
  BE-API (job-be) ──┐
                    ├──▶ FE-UI (job-fe) ──▶ QA-Test (job-qa)
  BE-DB (job-db) ───┘

Merge Order:
  1. PR #42 (job-be) - 의존성 없음
  2. PR #43 (job-db) - 의존성 없음  (1과 병렬 가능)
  3. PR #44 (job-fe) - job-be, job-db 완료 후
  4. PR #45 (job-qa) - job-fe 완료 후
```

### 머지 큐 알고리즘

```typescript
class MergeQueue {
  // 머지 가능한 PR 목록 조회
  getReadyToMerge(jobs: Job[]): Job[] {
    return jobs.filter(job => {
      // PR이 생성되었고
      if (!job.pr_number) return false;

      // 모든 선행 Job의 PR이 머지됨
      const dependsOn = job.depends_on || [];
      return dependsOn.every(depId => {
        const depJob = jobs.find(j => j.id === depId);
        return depJob?.status === 'done';
      });
    });
  }

  // 머지 순서 계산 (토폴로지 정렬)
  calculateMergeOrder(jobs: Job[]): string[][] {
    // 의존성 없는 Job부터 레벨 할당
    // 같은 레벨은 병렬 머지 가능
  }
}
```

---

## API Endpoints

### PR 관리

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/prs` | PR 목록 조회 |
| GET | `/api/offices/:id/prs/:prNumber` | PR 상태 조회 |
| POST | `/api/offices/:id/jobs/:jobId/create-pr` | PR 생성 |
| POST | `/api/offices/:id/prs/:prNumber/merge` | PR 머지 |
| POST | `/api/offices/:id/prs/:prNumber/sync` | 브랜치 동기화 |

### 머지 큐

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offices/:id/merge-queue` | 머지 큐 상태 |
| POST | `/api/offices/:id/merge-queue/process` | 머지 큐 처리 |

---

## GitHub Integration

### gh CLI 사용

```bash
# PR 생성
gh pr create \
  --title "[FE] 로그인 UI 구현" \
  --body "## Summary\n- 로그인 폼 구현\n- 유효성 검사 추가" \
  --label "agent:fe,auto-generated"

# PR 머지
gh pr merge 42 --squash --delete-branch

# PR 상태 확인
gh pr view 42 --json state,mergeable,mergeStateStatus
```

### Webhook 이벤트 (선택)

```typescript
// GitHub Webhook 수신 (pull_request event)
interface PRWebhookPayload {
  action: 'opened' | 'closed' | 'merged' | 'synchronize';
  number: number;
  pull_request: {
    state: string;
    merged: boolean;
    head: { ref: string };
    base: { ref: string };
  };
}
```

---

## Conflict Resolution

### 자동 해결 시도

```typescript
async function resolveConflict(worktreePath: string): Promise<boolean> {
  // 1. rebase 시도
  try {
    await git.rebase(['origin/main']);
    return true;
  } catch {
    // 2. 충돌 발생 시 abort
    await git.rebase(['--abort']);

    // 3. 충돌 파일 목록 반환
    return false;
  }
}
```

### 수동 해결 필요 시

```typescript
interface ConflictInfo {
  pr_number: number;
  conflicting_files: string[];
  suggested_action: 'manual_resolve' | 'recreate_branch';
}
```

- Agent에게 충돌 해결 프롬프트 전송
- 또는 사용자에게 수동 해결 요청

---

## Sequence Diagram

### PR 생성 및 머지 플로우

```text
Agent         Office Server       GitHub          Realtime
  │                │                 │               │
  │ Job 완료       │                 │               │
  │───────────────▶│                 │               │
  │                │  gh pr create   │               │
  │                │────────────────▶│               │
  │                │                 │               │
  │                │◀────────────────│               │
  │                │  PR #42 생성    │               │
  │                │                 │               │
  │                │  broadcast      │               │
  │                │─────────────────│──────────────▶│
  │                │                 │               │
  │                │ [의존성 PR 머지 대기]            │
  │                │                 │               │
  │                │  gh pr merge    │               │
  │                │────────────────▶│               │
  │                │                 │               │
  │                │◀────────────────│               │
  │                │  머지 완료      │               │
  │                │                 │               │
  │                │  Worktree 정리  │               │
  │◀───────────────│                 │               │
```

---

## Related Specs

- [03-Worktree](../03-worktree/spec.md) - Worktree 관리
- [04-Session Execution](../04-session-execution/spec.md) - 세션 관리
- [06-Realtime UI](../06-realtime-ui/spec.md) - PR 상태 UI
