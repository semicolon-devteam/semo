# create-pr Skill

> Agent 작업 완료 후 Pull Request 생성

## Purpose

Agent의 작업 브랜치에서 main 브랜치로 Pull Request를 생성합니다.
작업 내역을 요약하고 리뷰를 위한 PR을 자동으로 작성합니다.

## Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `worktree_path` | string | Yes | Worktree 경로 |
| `title` | string | No | PR 제목 (자동 생성 가능) |
| `body` | string | No | PR 본문 (자동 생성 가능) |
| `base` | string | No | 대상 브랜치 (기본: main) |
| `draft` | boolean | No | Draft PR 여부 (기본: false) |
| `job_id` | string | No | 연결된 Job ID |

## Execution Flow

```text
1. 입력 검증
   - Worktree 존재 확인
   - 커밋할 변경사항 확인
   ↓
2. 변경사항 커밋
   - git add -A
   - git commit (자동 메시지 생성)
   ↓
3. 원격에 Push
   - git push -u origin {branch}
   ↓
4. PR 생성
   - gh pr create
   ↓
5. DB 상태 업데이트
   - job_queue에 pr_number 저장
   ↓
6. 결과 반환
```

## Commands

### 변경사항 확인 및 커밋

```bash
cd {worktree_path}

# 변경사항 확인
git status --porcelain

# 모든 변경사항 스테이징
git add -A

# 커밋 (자동 메시지)
git commit -m "{commit_message}"
```

### 원격에 Push

```bash
# 현재 브랜치명 확인
branch=$(git branch --show-current)

# Push with upstream 설정
git push -u origin $branch
```

### PR 생성

```bash
# PR 생성 (gh CLI)
gh pr create \
  --title "{title}" \
  --body "{body}" \
  --base {base} \
  {--draft}

# 또는 상세 옵션
gh pr create \
  --title "{title}" \
  --body "$(cat <<'EOF'
## Summary

{summary}

## Changes

{changes}

## Testing

{testing}

---

Job ID: {job_id}
Agent: {agent_role}

EOF
)"
```

## Auto-generated Content

### PR 제목 생성 규칙

```text
[{Agent Role}] {Task Summary}

예시:
[FE] 로그인 페이지 UI 구현
[BE] 사용자 인증 API 엔드포인트 추가
[QA] 로그인 플로우 E2E 테스트 추가
```

### PR 본문 생성 규칙

```markdown
## Summary

{Task 설명을 1-2문장으로 요약}

## Changes

{변경된 파일 목록과 주요 변경사항}

- `src/app/login/page.tsx` - 로그인 페이지 컴포넌트 추가
- `src/components/LoginForm.tsx` - 로그인 폼 구현
- `src/lib/auth.ts` - 인증 유틸리티 함수

## Testing

{테스트 방법 또는 수행한 테스트}

- [ ] 로그인 성공 시나리오
- [ ] 잘못된 비밀번호 에러 처리
- [ ] 세션 만료 처리

---

**Job ID**: {job_id}
**Agent**: {agent_role}
**Depends on**: #{dependent_pr_numbers}
```

## Output

### 성공

```markdown
## PR 생성 완료

**PR**: #{pr_number}
**URL**: {pr_url}
**브랜치**: {branch} → {base}
**상태**: {Open/Draft}

리뷰를 기다립니다.
```

### 실패 (변경사항 없음)

```markdown
## PR 생성 불필요

커밋할 변경사항이 없습니다.
작업이 이미 완료되었거나, 변경사항이 없습니다.
```

## Error Handling

| 에러 | 원인 | 해결 |
|------|------|------|
| `no changes` | 변경사항 없음 | 작업 확인 |
| `authentication failed` | GitHub 인증 실패 | `gh auth login` |
| `branch exists` | 원격에 이미 브랜치 존재 | `--force` push |
| `PR already exists` | 이미 PR 존재 | 기존 PR 업데이트 |

## DB Update

```sql
UPDATE job_queue
SET pr_number = {pr_number}, status = 'done'
WHERE id = '{job_id}';

UPDATE worktrees
SET status = 'idle'
WHERE path = '{worktree_path}';
```

## Example

```bash
# 기본 PR 생성
skill:create-pr(
  worktree_path: "/workspace/my-project/agent/fe"
)

# 상세 옵션
skill:create-pr(
  worktree_path: "/workspace/my-project/agent/be",
  title: "[BE] 사용자 인증 API 구현",
  base: "develop",
  draft: true,
  job_id: "job-123"
)
```

## Related Skills

- `create-worktree` - Worktree 생성
- `merge-pr` - PR 머지
- `sync-branch` - 브랜치 동기화
