# GitHub Projects GraphQL Reference

> 테스트중 상태 변경에 필요한 GraphQL 쿼리

## 전체 실행 스크립트

```bash
#!/bin/bash
# change-to-testing.sh
# Usage: ./change-to-testing.sh {repo} {issue_number}

REPO=$1
ISSUE_NUMBER=$2
ORG="semicolon-devteam"
PROJECT_NUMBER=1
QA_ASSIGNEE="kokkh"

# 1. Project ID 조회
PROJECT_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) { id }
  }
}' -f org="$ORG" -F number=$PROJECT_NUMBER --jq '.data.organization.projectV2.id')

echo "Project ID: $PROJECT_ID"

# 2. Item ID 조회
ITEM_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              number
              repository { name }
            }
          }
        }
      }
    }
  }
}' -f org="$ORG" -F number=$PROJECT_NUMBER \
--jq ".data.organization.projectV2.items.nodes[] | select(.content.number == $ISSUE_NUMBER and .content.repository.name == \"$REPO\") | .id")

echo "Item ID: $ITEM_ID"

# 3. Status Field ID 조회
FIELD_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField { id }
      }
    }
  }
}' -f org="$ORG" -F number=$PROJECT_NUMBER --jq '.data.organization.projectV2.field.id')

echo "Field ID: $FIELD_ID"

# 4. "테스트중" Option ID 조회
OPTION_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          options { id name }
        }
      }
    }
  }
}' -f org="$ORG" -F number=$PROJECT_NUMBER --jq '.data.organization.projectV2.field.options[] | select(.name == "테스트중") | .id')

echo "Option ID (테스트중): $OPTION_ID"

# 5. 상태 변경
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item { id }
  }
}' -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$FIELD_ID" -f optionId="$OPTION_ID"

echo "Status changed to 테스트중"

# 6. QA 담당자 할당
gh issue edit $ISSUE_NUMBER --repo $ORG/$REPO --add-assignee $QA_ASSIGNEE

echo "QA assignee added: @$QA_ASSIGNEE"

# 7. 이슈 코멘트
gh issue comment $ISSUE_NUMBER --repo $ORG/$REPO --body "🧪 **테스트 요청됨**

상태가 **테스트중**으로 변경되었습니다.
QA 담당자: @$QA_ASSIGNEE

---
*SAX에서 자동 처리됨*"

echo "Comment added"
```

## 개별 쿼리 설명

### Project ID 조회

조직의 Project V2 ID를 가져옵니다.

```graphql
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      id
    }
  }
}
```

### Item ID 조회

특정 이슈의 Project Item ID를 가져옵니다.

```graphql
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              number
              repository { name }
            }
          }
        }
      }
    }
  }
}
```

### Status 필드 및 옵션 조회

Status 필드의 ID와 각 옵션(상태값)의 ID를 가져옵니다.

```graphql
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options {
            id
            name
          }
        }
      }
    }
  }
}
```

### 상태 변경 Mutation

Project Item의 Status 필드를 업데이트합니다.

```graphql
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
```

## 상태값 참조

```bash
# 모든 상태 옵션 조회
gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          options { id name }
        }
      }
    }
  }
}' --jq '.data.organization.projectV2.field.options[]'
```

예상 결과:

```json
{"id":"xxx1","name":"백로그"}
{"id":"xxx2","name":"진행중"}
{"id":"xxx3","name":"리뷰요청"}
{"id":"xxx4","name":"테스트중"}
{"id":"xxx5","name":"수정요청"}
{"id":"xxx6","name":"확인요청"}
{"id":"xxx7","name":"병합됨"}
```
