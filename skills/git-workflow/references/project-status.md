# Project Status Management

> GitHub Projects의 이슈카드 상태(Status) 관리

## 개요

이슈가 연결된 GitHub Project의 Status 필드를 자동으로 관리합니다.

**전제 조건**:

- 이슈가 `이슈관리` Project (번호: 1)에 연결되어 있음
- Status 필드가 존재함

## 전체 상태 목록

> **⚠️ SoT**: 상태 목록은 GitHub Project에서 직접 조회합니다.

### 상태 조회 명령

```bash
# GitHub Project 상태 목록 조회
gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            options {
              name
              color
              description
            }
          }
        }
      }
    }
  }
' --jq '.data.organization.projectV2.field.options[] | "| \(.name) | \(.color) | \(.description // "-") |"'
```

> 📌 상태 목록이 필요할 때 위 명령어로 직접 조회하세요. 하드코딩된 목록은 실제 설정과 다를 수 있습니다.

## 상태 전환 규칙

| 트리거 | 변경 전 상태 | 변경 후 상태 |
|--------|-------------|-------------|
| 이슈 작업 시작 | 검수대기, 검수완료 | **작업중** |
| 확인 요청 | 작업중 | **확인요청** |
| 리뷰 요청 (PR Ready) | 작업중 | **리뷰요청** |
| 리뷰 후 수정 필요 | 리뷰요청 | **수정요청** |
| PR 머지 완료 | 리뷰요청 | **테스트중** |
| QA 테스트 통과 | 테스트중 | **병합됨** |
| 작업 취소 | Any | **버려짐** |

## API 워크플로우

### 1. 이슈의 Project Item ID 조회

```bash
# 이슈가 연결된 Project Item 조회
gh api graphql -f query='
query($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      projectItems(first: 10) {
        nodes {
          id
          project {
            title
            number
          }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              optionId
            }
          }
        }
      }
    }
  }
}' -f owner="semicolon-devteam" -f repo="${REPO}" -F issueNumber="${ISSUE_NUM}"
```

### 2. Project의 Status 필드 옵션 조회

```bash
# Project의 Status 필드 옵션 ID 조회
gh api graphql -f query='
query($org: String!, $projectNumber: Int!) {
  organization(login: $org) {
    projectV2(number: $projectNumber) {
      id
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
}' -f org="semicolon-devteam" -F projectNumber=1
```

### 3. Status 변경

```bash
# Status 값 업데이트
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
    projectV2Item {
      id
    }
  }
}' -f projectId="${PROJECT_ID}" -f itemId="${ITEM_ID}" -f fieldId="${FIELD_ID}" -f optionId="${OPTION_ID}"
```

## 상태 변경 시점

### 작업 시작 시 → "작업중"

**트리거**:
- `{repo}#{number}` 형식으로 이슈 언급 + 작업 시작 의도
- 이슈 URL로 온보딩 시작
- "이 이슈 시작할게", "작업 시작" 등의 표현

**조건**:
- 현재 상태가 "작업중"이 **아닌** 경우에만 변경

**출력**:
```markdown
[SAX] skill:git-workflow: 이슈 상태 변경

📋 **이슈**: {repo}#{number}
🔄 **상태 변경**: {이전 상태} → **작업중**

Project: 이슈카드
```

### PR 머지 시 → "테스트중"

**트리거**:
- PR이 성공적으로 머지됨
- `gh pr merge` 또는 웹에서 머지 버튼 클릭

**조건**:
- PR 본문에 `Related #{number}` 형식으로 이슈 연결
- 이슈가 Project에 연결되어 있음

**출력**:
```markdown
[SAX] skill:git-workflow: 이슈 상태 변경

📋 **이슈**: {repo}#{number}
🔄 **상태 변경**: 작업중 → **테스트중**

다음 단계: STG 환경에서 QA 테스트 진행
```

### QA 테스트 통과 시 → "병합됨"

**트리거**:

- QA 담당자가 STG 환경에서 테스트 통과 확인
- SAX-QA에서 `test-pass` 처리

**조건**:
- PR 본문에 `Related #{number}` 형식으로 이슈 연결
- 이슈가 Project에 연결되어 있음
- 현재 상태가 "테스트중"

**출력**:
```markdown
[SAX] skill:git-workflow: 이슈 상태 변경

📋 **이슈**: {repo}#{number}
🔄 **상태 변경**: 테스트중 → **병합됨**

다음 단계: 프로덕션 배포 진행
```

## 에러 처리

### Project 연결 없음

```markdown
⚠️ 이슈가 Project에 연결되어 있지 않습니다.

**이슈**: {repo}#{number}

이슈를 '이슈관리' Project에 연결한 후 다시 시도해주세요.
```

### 권한 오류

```markdown
❌ Project 상태 변경 권한이 없습니다.

**Project**: 이슈카드
**필요 권한**: write

Organization admin에게 권한을 요청하세요.
```

### Status 필드 없음

```markdown
⚠️ Project에 'Status' 필드가 없습니다.

**Project**: 이슈카드

Project 설정에서 Status 필드를 추가해주세요.
```
