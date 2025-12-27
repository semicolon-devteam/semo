---
name: list-my-tasks
description: |
  내 할당 작업 조회. Use when (1) "내 할당된 작업", (2) "내 이슈 확인",
  (3) "나한테 할당된 거". GitHub에서 로그인 유저에게 할당된 Open 이슈 조회.
tools: [Bash]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: list-my-tasks 호출`

# list-my-tasks Skill

> 할당된 작업 목록 조회

## Purpose

GitHub에서 로그인된 사용자(@me)에게 할당된 Open 상태의 이슈를 조회합니다.

## Workflow

### Step 1: 현재 사용자 확인

```bash
gh api user --jq '.login'
```

### Step 2: 할당된 이슈 조회

```bash
# semicolon-devteam 조직의 모든 레포에서 @me 할당 이슈 조회
gh api graphql -f query='
query {
  search(
    query: "org:semicolon-devteam is:issue is:open assignee:@me"
    type: ISSUE
    first: 50
  ) {
    issueCount
    nodes {
      ... on Issue {
        number
        title
        repository {
          name
        }
        labels(first: 5) {
          nodes {
            name
          }
        }
        projectItems(first: 1) {
          nodes {
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
          }
        }
        createdAt
        updatedAt
      }
    }
  }
}
'
```

### Step 3: 우선순위 분류

```text
🔴 Critical: blocker, critical, urgent 라벨
🟠 High: high-priority, bug 라벨
🟡 Medium: feature, enhancement 라벨
⚪ Low: 기타
```

### Step 4: 상태별 분류

```text
📋 대기중: Backlog, Ready
🔨 작업중: In Progress, 작업중
📝 리뷰중: Review, PR Review
✅ 완료대기: Done, Testing
```

## Output Format

```markdown
## 할당된 작업

**사용자**: @username
**조회일**: 2025-12-15

### 🔨 작업중 (2건)

| 레포 | # | 제목 | 라벨 | 업데이트 |
|------|---|------|------|----------|
| cm-land | #123 | 로그인 페이지 구현 | feature | 2시간 전 |
| cm-office | #45 | 결제 버그 수정 | bug | 1일 전 |

### 📋 대기중 (3건)

| 레포 | # | 제목 | 라벨 | 생성일 |
|------|---|------|------|--------|
| cm-land | #130 | 마이페이지 기능 | feature | 3일 전 |
| ... | ... | ... | ... | ... |

---

**총 할당 작업**: 5건
```

## Expected Output

```markdown
[SEMO] Skill: list-my-tasks 호출

## 할당된 작업

**사용자**: @reus
**조회일**: 2025-12-15

### 🔨 작업중 (1건)

| 레포 | # | 제목 | 라벨 |
|------|---|------|------|
| cm-land | #123 | 로그인 페이지 구현 | feature |

### 📋 대기중 (2건)

| 레포 | # | 제목 | 라벨 |
|------|---|------|------|
| cm-land | #130 | 마이페이지 기능 | feature |
| cm-office | #50 | 대시보드 개선 | enhancement |

---

**총 할당 작업**: 3건

[SEMO] Skill: list-my-tasks 완료
```

## Quick Actions

조회 후 바로 작업을 시작하려면:

```markdown
> "랜드 #123 작업 진행하자"
→ start-task 스킬 호출

> "#123 상태 변경해줘"
→ change-task-status 스킬 호출

> "오피스 #45 PR 만들어줘"
→ git-workflow 스킬 호출
```

## References

- [biz/management CLAUDE.md](../../CLAUDE.md)
- [start-task Skill](../../skills/start-task/SKILL.md)
- [assign-task Skill](../assign-task/SKILL.md)
