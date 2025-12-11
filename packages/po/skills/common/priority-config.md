# Priority Configuration

> GitHub Projects #1 (이슈관리) 우선순위/타입 필드 설정을 위한 공통 설정

## Project & Field IDs

```yaml
Project ID: PVT_kwDOC01-Rc4AtDz2
Field ID (우선순위): PVTSSF_lADOC01-Rc4AtDz2zg0YPyI
Field ID (타입): PVTSSF_lADOC01-Rc4AtDz2zg2XDtA
```

## 타입 옵션

| 타입 | Option ID | 설명 |
|------|-----------|------|
| 에픽 | `389a3389` | Epic 이슈 |
| 버그 | `acbe6dfc` | Bug 이슈 |
| 태스크 | `851de036` | Task 이슈 |

## 우선순위 옵션

| 우선순위 | Option ID | 설명 |
|----------|-----------|------|
| P0(긴급) | `a20917be` | 즉시 처리 필요 |
| P1(높음) | `851dbd77` | 이번 스프린트 내 |
| P2(보통) | `e3b68a2a` | 일반 백로그 (기본값) |
| P3(낮음) | `2ba68eff` | 여유 있을 때 |
| P4(매우 낮음) | `746928cf` | 나중에 |

## 심각도 → 우선순위 매핑 (버그용)

| 심각도 | 우선순위 | Option ID |
|--------|----------|-----------|
| Critical | P0(긴급) | `a20917be` |
| High | P1(높음) | `851dbd77` |
| Medium | P2(보통) | `e3b68a2a` |
| Low | P3(낮음) | `2ba68eff` |

## GraphQL: Projects에 Item 추가 + 우선순위 설정

### Step 1: Issue Node ID 조회

```bash
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{repo}/issues/{issue_number} --jq '.node_id')
```

### Step 2: Projects #1에 Item 추가 및 Item ID 획득

```bash
ITEM_ID=$(gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" -f contentId="$ISSUE_NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')
```

### Step 3: 우선순위 필드 설정

```bash
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
' -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="$ITEM_ID" \
  -f fieldId="PVTSSF_lADOC01-Rc4AtDz2zg0YPyI" \
  -f optionId="{OPTION_ID}"
```

> **Note**: `{OPTION_ID}`를 위 테이블에서 해당하는 Option ID로 대체하세요.

## 사용 예시

### Epic에 P1(높음) 우선순위 설정

```bash
# 1. Issue Node ID 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/docs/issues/123 --jq '.node_id')

# 2. Projects에 추가 및 Item ID 획득
ITEM_ID=$(gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" -f contentId="$ISSUE_NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')

# 3. 우선순위 설정 (P1 높음)
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
' -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="$ITEM_ID" \
  -f fieldId="PVTSSF_lADOC01-Rc4AtDz2zg0YPyI" \
  -f optionId="851dbd77"
```

## Related

- [create-epic Skill](../create-epic/skill.md)
- [report-bug Skill](../report-bug/SKILL.md)
