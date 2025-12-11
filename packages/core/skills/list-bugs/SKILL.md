---
name: list-bugs
description: |
  GitHub Projects '타입' 필드 기반 버그 이슈 조회. Use when (1) "버그 이슈 목록",
  (2) "버그 확인", (3) "버그 조회", (4) Projects 타입=버그 이슈 필터링.
tools: [Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: list-bugs 호출` 시스템 메시지를 첫 줄에 출력하세요.

# list-bugs Skill

> GitHub Projects '타입' 필드 기반 버그 이슈 조회

## Purpose

GitHub 라벨 대신 `이슈관리` Projects의 `타입` 필드를 기준으로 버그 이슈를 조회합니다.

### 기존 방식의 문제점

```bash
# 기존: 라벨 기반 (레포마다 naming이 다름)
gh issue list --label "bug" --state open
gh issue list --label "BugFix" --state open
gh issue list --label "🐛" --state open
```

- 레포마다 라벨 naming이 다름 (bug, BugFix, 🐛, fix 등)
- 일부 레포는 bug 라벨이 없음
- 일관된 조회 불가

### 새 방식: Projects 타입 필드 기준

```bash
# Projects 타입=버그 필터 조회 (GraphQL)
gh api graphql -f query='...' --jq '... | select(.type == "버그")'
```

## Trigger Keywords

- "버그 이슈", "버그 목록", "버그 조회"
- "열린 버그", "open 버그"
- "Projects 버그"

## Configuration

### 이슈관리 Projects 정보

| 항목 | 값 |
|------|-----|
| **Project ID** | `PVT_kwDOC01-Rc4AtDz2` |
| **Project Name** | 이슈관리 |
| **Organization** | semicolon-devteam |

### 타입 필드 옵션

| 타입 | Option ID | 용도 |
|------|-----------|------|
| 에픽 | `389a3389` | Epic 이슈 |
| 버그 | `acbe6dfc` | Bug 이슈 |
| 태스크 | `851de036` | Task 이슈 |

## Workflow

### 1. GraphQL 쿼리 실행

```bash
PROJECT_ID="PVT_kwDOC01-Rc4AtDz2"

gh api graphql -f query='
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            fieldValueByName(name: "타입") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
            content {
              ... on Issue {
                number
                title
                url
                state
                createdAt
                repository {
                  name
                }
                assignees(first: 3) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
' -f projectId="$PROJECT_ID"
```

### 2. 버그 타입 필터링

```bash
# 버그 타입이고 OPEN 상태인 이슈만 필터
gh api graphql -f query='...' -f projectId="$PROJECT_ID" \
  --jq '
    .data.node.items.nodes[]
    | select(.fieldValueByName.name == "버그")
    | select(.content.state == "OPEN")
    | .content
  '
```

### 3. 결과 포맷팅

```bash
# 테이블 형식으로 출력
gh api graphql ... --jq '
  .data.node.items.nodes[]
  | select(.fieldValueByName.name == "버그")
  | select(.content.state == "OPEN")
  | "| #\(.content.number) | \(.content.repository.name) | \(.content.title) | \(.content.createdAt | split("T")[0]) |"
'
```

## Output Format

```markdown
## 🐛 버그 이슈 현황 (Projects 타입 기준)

| # | 레포 | 제목 | 담당자 | 생성일 |
|---|------|------|--------|--------|
| #123 | core-backend | API 응답 지연 | kyago | 2025-12-01 |
| #456 | community-web | 버튼 클릭 안됨 | Reus | 2025-12-05 |

---
**총 2개의 Open 버그 이슈**
```

## 전체 스크립트

> ⚠️ **주의**: GraphQL 쿼리에 한글 필드명(`타입`)이 포함되어 있어 인라인 `--jq` 옵션 대신 파일 기반 처리가 필요합니다.

```bash
#!/bin/bash

PROJECT_ID="PVT_kwDOC01-Rc4AtDz2"

# GraphQL 쿼리 파일 생성
cat > /tmp/projects_query.graphql << 'QUERY'
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          fieldValueByName(name: "타입") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          content {
            ... on Issue {
              number
              title
              url
              state
              createdAt
              repository {
                name
              }
              assignees(first: 3) {
                nodes {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
}
QUERY

echo "## 🐛 버그 이슈 현황 (Projects 타입 기준)"
echo ""
echo "| # | 레포 | 제목 | 담당자 | 생성일 |"
echo "|---|------|------|--------|--------|"

# 쿼리 실행 및 결과 저장
gh api graphql -F projectId="$PROJECT_ID" -f query="$(cat /tmp/projects_query.graphql)" > /tmp/projects_result.json 2>&1

# 버그 타입이고 OPEN 상태인 것만 필터링
RESULT=$(cat /tmp/projects_result.json | jq '[.data.node.items.nodes[] | select(.fieldValueByName.name == "버그") | select(.content.state == "OPEN")]')

COUNT=$(echo "$RESULT" | jq 'length')

if [ "$COUNT" -eq 0 ]; then
  echo "| - | - | 버그 이슈 없음 | - | - |"
else
  echo "$RESULT" | jq -r '.[] | "| #\(.content.number) | \(.content.repository.name) | \(.content.title) | \(.content.assignees.nodes | map(.login) | join(\", \") | if . == \"\" then \"-\" else . end) | \(.content.createdAt | split(\"T\")[0]) |"'
fi

echo ""
echo "---"
echo "**총 ${COUNT}개의 Open 버그 이슈**"

# 임시 파일 정리
rm -f /tmp/projects_query.graphql /tmp/projects_result.json
```

## No Bugs Case

```markdown
## 🐛 버그 이슈 현황 (Projects 타입 기준)

✅ 현재 Open 상태의 버그 이슈가 없습니다.
```

## Error Handling

### Projects 접근 권한 없음

```markdown
⚠️ **Projects 접근 오류**

이슈관리 Projects에 접근할 수 없습니다.
- Project ID: PVT_kwDOC01-Rc4AtDz2
- 권한을 확인해주세요.
```

### GraphQL 쿼리 실패

```markdown
⚠️ **쿼리 실패**

GraphQL API 호출이 실패했습니다.
GitHub 인증 상태를 확인해주세요: `gh auth status`
```

## SEMO Message Format

```markdown
[SEMO] Skill: list-bugs 호출

[SEMO] Skill: list-bugs 완료 - {N}개 버그 이슈 발견
```

## 라벨 기반 조회 (Fallback)

Projects 조회가 실패할 경우 라벨 기반으로 폴백:

```bash
# Fallback: 라벨 기반 조회
for repo in $(gh repo list semicolon-devteam --json name --jq '.[].name'); do
  gh issue list --repo "semicolon-devteam/$repo" --label "bug" --state open 2>/dev/null
done
```

## Related

- [이슈 #6](https://github.com/semicolon-devteam/semo-core/issues/6) - 버그 이슈 조회 시 Projects 타입 필드 기준 조회 지원
- [check-feedback Skill](../check-feedback/SKILL.md) - 피드백 이슈 수집
