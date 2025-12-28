# GraphQL Queries

> audit-issues Skill에서 사용하는 GraphQL 쿼리 전체 목록

## 프로젝트 정보

### 프로젝트 ID 및 필드 조회

```graphql
query GetProjectInfo {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      title
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

**CLI 실행**:
```bash
gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        id
        title
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field { id name dataType }
            ... on ProjectV2SingleSelectField { id name options { id name } }
          }
        }
      }
    }
  }
'
```

---

## 프로젝트 아이템 조회

### 전체 아이템 조회 (페이지네이션)

```graphql
query GetAllProjectItems($cursor: String) {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              body
              state
              createdAt
              labels(first: 10) {
                nodes { name }
              }
              repository {
                name
              }
            }
          }
          fieldValues(first: 15) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field { ... on ProjectV2IterationField { name } }
              }
            }
          }
        }
      }
    }
  }
}
```

**CLI 실행** (첫 페이지):
```bash
gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        items(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue {
                number
                title
                body
                state
                repository { name }
              }
            }
            fieldValues(first: 15) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2Field { name } }
                }
              }
            }
          }
        }
      }
    }
  }
'
```

---

## 레포지토리 이슈 조회

### Open 이슈 + Projects 연결 정보

```bash
gh issue list \
  --repo semicolon-devteam/{REPO_NAME} \
  --state open \
  --json number,title,body,labels,projectItems,createdAt
```

### 전체 레포지토리 순회

```bash
REPOS="semicolon-app semicolon-web semicolon-api core-supabase docs sax"

for repo in $REPOS; do
  echo "=== $repo ==="
  gh issue list --repo semicolon-devteam/$repo --state open --json number,title,projectItems
done
```

---

## 필드 값 추출 헬퍼

### GitHub Issue Type 조회

> **Projects 커스텀 필드 '타입' 대신 GitHub Issue Type을 사용합니다.**

```bash
# GitHub Issue Type 조회 (gh issue list)
gh issue list --repo semicolon-devteam/semo --state open \
  --json number,title,issueType \
  --jq '.[] | {issue: .number, title: .title, type: .issueType.name}'
```

### Issue Type 미설정 이슈 필터링

```bash
# GitHub Issue Type이 설정되지 않은 이슈 필터링
gh issue list --repo semicolon-devteam/semo --state open \
  --json number,title,issueType \
  --jq '.[] | select(.issueType == null or .issueType.name == null)'
```

### 우선순위 미설정 이슈 필터링 (Projects 필드)

```bash
gh api graphql -f query='...' | jq '
  .data.organization.projectV2.items.nodes[] |
  select(
    (.fieldValues.nodes | map(select(.field.name == "우선순위")) | length) == 0
  ) |
  {
    issue: .content.number,
    title: .content.title,
    repo: .content.repository.name
  }
'
```

### 작업량 미할당 Task 필터링

```bash
# Issue Type이 Task인 이슈 중 작업량 미설정 필터링
# 1단계: Task 타입 이슈 조회
gh issue list --repo semicolon-devteam/semo --state open \
  --json number,title,issueType \
  --jq '.[] | select(.issueType.name == "Task") | .number'

# 2단계: Projects 작업량 필드 확인 (GraphQL)
gh api graphql -f query='...' | jq '
  .data.organization.projectV2.items.nodes[] |
  select(
    (.fieldValues.nodes | map(select(.field.name == "작업량" and .number != null)) | length) == 0
  ) |
  {
    issue: .content.number,
    title: .content.title,
    repo: .content.repository.name
  }
'
```

---

## 통합 감사 스크립트

```bash
#!/bin/bash

# 이슈관리 프로젝트 전체 아이템 조회
PROJECT_DATA=$(gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                number
                title
                body
                state
                repository { name }
              }
            }
            fieldValues(first: 15) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2Field { name } }
                }
              }
            }
          }
        }
      }
    }
  }
')

echo "$PROJECT_DATA" > /tmp/project_items.json

# 감사 실행
echo "=== 우선순위 누락 검토 ==="
jq '.data.organization.projectV2.items.nodes[] |
  select(.content.state == "OPEN") |
  select(
    ([.fieldValues.nodes[] | select(.field.name == "우선순위")] | length) == 0
  ) |
  "\(.content.repository.name)#\(.content.number): \(.content.title) - 우선순위 누락"
' /tmp/project_items.json

echo ""
echo "=== 작업량 미할당 Task ==="
# Note: Issue Type은 GitHub Issue의 기본 속성으로, gh issue list --json issueType으로 조회
# Projects GraphQL에서는 작업량 필드만 확인
jq '.data.organization.projectV2.items.nodes[] |
  select(.content.state == "OPEN") |
  select(
    ([.fieldValues.nodes[] | select(.field.name == "작업량" and .number != null)] | length) == 0
  ) |
  "\(.content.repository.name)#\(.content.number): \(.content.title)"
' /tmp/project_items.json
```

---

## 에러 핸들링

### Rate Limit 확인

```bash
gh api rate_limit --jq '.resources.graphql'
```

### 페이지네이션 처리

```bash
cursor=""
while true; do
  if [ -z "$cursor" ]; then
    result=$(gh api graphql -f query='...' )
  else
    result=$(gh api graphql -f query='...' -f cursor="$cursor")
  fi

  # 데이터 처리
  echo "$result" | jq '.data.organization.projectV2.items.nodes[]'

  # 다음 페이지 확인
  has_next=$(echo "$result" | jq '.data.organization.projectV2.items.pageInfo.hasNextPage')
  if [ "$has_next" != "true" ]; then
    break
  fi
  cursor=$(echo "$result" | jq -r '.data.organization.projectV2.items.pageInfo.endCursor')
done
```
