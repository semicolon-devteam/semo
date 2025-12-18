---
name: list-bugs
description: |
  버그 목록 조회. Use when (1) "버그 목록", "이슈 목록",
  (2) open 버그 확인, (3) 우선순위 버그 확인.
tools: [Bash]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: list-bugs` 시스템 메시지를 첫 줄에 출력하세요.

# list-bugs Skill

> GitHub 버그/이슈 목록 조회

## Trigger Keywords

- "버그 목록", "이슈 목록"
- "open 버그 뭐 있어"
- "해결해야 할 버그"

## 조회 명령

### 기본 조회 (Assignee 포함)

```bash
# 현재 레포지토리 또는 지정된 레포에서 조회
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'semicolon-devteam/semo')}"

gh api "repos/$REPO/issues" \
  --jq '.[] | select(.state == "open") | "| #\(.number) | \(.title) | @\(.assignee.login // "-") |"'
```

### Status 포함 조회 (Projects GraphQL)

```bash
# 이슈의 Projects Status 조회
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      projectItems(first: 1) {
        nodes {
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
        }
      }
    }
  }
}' -f owner="semicolon-devteam" -f repo="$REPO_NAME" -F number=$ISSUE_NUMBER \
  --jq '.data.repository.issue.projectItems.nodes[0].fieldValueByName.name // "-"'
```

## 출력 형식

```markdown
## 🐛 Open 버그 목록

| # | 제목 | 담당자 | 상태 |
|---|------|--------|------|
| #659 | SEO가 각 게시판별로 적용되지 않음 | @reus-jeon | 작업중 |
| #658 | 메인페이지 갤러리 4번째 탭 안나오는 현상 | - | 검수대기 |

**총 2건의 Open 버그**
```

## 레포지토리 지정

```bash
# 특정 레포 버그 조회
"cm-land 버그 목록 보여줘"
→ REPO="semicolon-devteam/cm-land" 로 조회

# 현재 레포 버그 조회 (기본)
"버그 목록 보여줘"
→ 현재 디렉토리의 git remote 기반 조회
```
