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
## 🐛 {repo} Open 버그 목록

| # | 제목 | 담당자 | 상태 |
|---|------|--------|------|
| #659 | SEO가 각 게시판별로 적용되지 않음 | @reus-jeon | 작업중 |
| #658 | 메인페이지 갤러리 4번째 탭 안나오는 현상 | - | 검수대기 |

**총 2건의 Open 버그**

---
💡 다른 프로젝트(cm-office, core-backend 등)의 이슈도 확인할까요?
```

## 🔴 현재 레포지토리 우선 규칙 (Context-First)

> **필수**: 레포지토리 명시 없이 요청 시 현재 git remote 기반 조회

### 컨텍스트 감지 우선순위

```bash
# 1순위: 현재 디렉토리의 git remote
REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/')

# 2순위: 사용자 명시 레포 (예: "cm-land 버그 목록")
# 3순위: 전체 조회 ("모든 레포", "전체 이슈" 키워드 감지 시)
```

### 예시

| 요청 | 동작 |
|------|------|
| "버그 목록 보여줘" | 현재 git remote 레포만 조회 |
| "cm-land 버그 목록" | cm-land 레포만 조회 |
| "모든 레포 버그 목록" | 전체 레포 조회 |

### 추가 확인 제안

응답 말미에 항상 다음 문구 추가:

```markdown
---
💡 다른 프로젝트({other_repos})의 이슈도 확인할까요?
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
