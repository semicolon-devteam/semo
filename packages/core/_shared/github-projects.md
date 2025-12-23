# GitHub Projects 공통 설정

> SEMO 패키지에서 공통으로 참조하는 GitHub Projects 설정

## 🔴 이슈관리 프로젝트 (하드코딩)

> **⚠️ 이 설정은 모든 Semicolon 프로젝트에서 공통으로 사용됩니다.**
> **프로젝트별 `.claude/memory/projects.md`에 별도 설정 불필요.**

### 기본 정보

| 항목 | 값 |
|------|-----|
| **프로젝트 이름** | 이슈관리 |
| **Project Number** | 1 |
| **Project ID** | `PVT_kwDOC01-Rc4AtDz2` |
| **Organization** | semicolon-devteam |

### Status Field

| 항목 | 값 |
|------|-----|
| **Field ID** | `PVTSSF_lADOC01-Rc4AtDz2zgj4dzs` |

### Status Options

| Status | Option ID | 설명 |
|--------|-----------|------|
| 백로그 | - | 초기 상태 |
| 검수대기 | - | Epic 생성 시 기본값 |
| 작업중 | `47fc9ee4` | 개발 진행 중 |
| 리뷰요청 | `9b58620e` | 코드 리뷰 대기 |
| 테스트중 | `13a75176` | QA 테스트 단계 |
| 병합됨 | `98236657` | 작업 완료 |

## 사용 예시

### GraphQL 쿼리에서 사용

```bash
# Project ID 직접 사용
PROJECT_ID="PVT_kwDOC01-Rc4AtDz2"
STATUS_FIELD_ID="PVTSSF_lADOC01-Rc4AtDz2zgj4dzs"

# 테스트중 상태로 변경
TESTING_OPTION_ID="13a75176"

gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="$PROJECT_ID" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$STATUS_FIELD_ID" \
  -f optionId="$TESTING_OPTION_ID"
```

### Organization/Number로 조회

```bash
# 동적 조회 (필요시)
gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
}'
```

## 관련 스킬

| 스킬 | 용도 |
|------|------|
| `project-status` | Status 필드 변경 |
| `project-board` | 이슈 프로젝트 추가 및 상태 관리 |
| `change-to-testing` | 테스트중 상태 변경 + QA 할당 |

## Related

- [팀원 정보](team-members.md)
- [Slack 설정](slack-config.md)
