---
name: set-project-field
description: |
  GitHub Projects 필드 값 설정 (공통 Skill). Use when (1) Issue에 작업량/우선순위 설정,
  (2) Draft Task 생성 후 필드 자동 설정, (3) 타입/기술영역 필드 업데이트.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: set-project-field 호출 - {필드명}` 시스템 메시지를 첫 줄에 출력하세요.

# set-project-field Skill

> GitHub Projects 필드 값을 자동으로 설정하는 SEMO 공통 Skill

## Purpose

GitHub Issues를 '이슈관리' Project에 추가한 후, 작업량/우선순위/타입 등의 필드 값을 자동으로 설정합니다.

### 지원 필드

| 필드명 | 필드 ID | 데이터 타입 | 설명 |
|--------|---------|-------------|------|
| **작업량** | `PVTF_lADOC01-Rc4AtDz2zg0bhf0` | NUMBER | Estimation Point (1, 2, 3, 5, 8, 13) |
| **우선순위** | `PVTSSF_lADOC01-Rc4AtDz2zg0YPyI` | SINGLE_SELECT | P0~P4 |
| **타입** | `PVTSSF_lADOC01-Rc4AtDz2zg2XDtA` | SINGLE_SELECT | 에픽/버그/태스크 |
| **기술영역** | `PVTSSF_lADOC01-Rc4AtDz2zg0X5BE` | SINGLE_SELECT | 프론트/백엔드/인프라 등 |
| **시작일** | `PVTF_lADOC01-Rc4AtDz2zgs0OE4` | DATE | 작업 시작 예정일 |
| **목표일** | `PVTF_lADOC01-Rc4AtDz2zg0X7kk` | DATE | 작업 완료 목표일 |

## Configuration

### Project ID

```
이슈관리 Project: PVT_kwDOC01-Rc4AtDz2
```

### 권한 요구사항

```bash
# project scope 필요
gh auth refresh -s project
```

## Quick Start

### 1. Issue의 Project Item ID 조회

```bash
# Issue number로 Item ID 조회
ISSUE_NUMBER=123
REPO="semicolon-devteam/docs"

# Issue의 node_id 조회
ISSUE_NODE_ID=$(gh api repos/$REPO/issues/$ISSUE_NUMBER --jq '.node_id')

# Project Item ID 조회 (이미 Project에 추가된 경우)
ITEM_ID=$(gh api graphql -f query='
  query($nodeId: ID!) {
    node(id: $nodeId) {
      ... on Issue {
        projectItems(first: 10) {
          nodes {
            id
            project {
              id
            }
          }
        }
      }
    }
  }
' -f nodeId="$ISSUE_NODE_ID" \
  --jq '.data.node.projectItems.nodes[] | select(.project.id == "PVT_kwDOC01-Rc4AtDz2") | .id')
```

### 2. 작업량 (Estimation Point) 설정

```bash
# NUMBER 타입 필드 설정
EFFORT=5  # 1, 2, 3, 5, 8, 13

gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $value }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="$ITEM_ID" \
  -f fieldId="PVTF_lADOC01-Rc4AtDz2zg0bhf0" \
  -F value="$EFFORT"
```

### 3. 우선순위 설정

```bash
# SINGLE_SELECT 타입 필드 설정
# P0(긴급): a20917be, P1(높음): 851dbd77, P2(보통): e3b68a2a
# P3(낮음): 2ba68eff, P4(매우 낮음): 746928cf

PRIORITY_OPTION="e3b68a2a"  # P2(보통)

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
  -f optionId="$PRIORITY_OPTION"
```

### 4. 타입 설정

```bash
# 타입 옵션: 에픽(389a3389), 버그(acbe6dfc), 태스크(851de036)

TYPE_OPTION="851de036"  # 태스크

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
  -f fieldId="PVTSSF_lADOC01-Rc4AtDz2zg2XDtA" \
  -f optionId="$TYPE_OPTION"
```

### 5. 날짜 필드 설정

```bash
# DATE 타입 필드 설정 (ISO 8601 형식)
TARGET_DATE="2024-12-31"

gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { date: $date }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="$ITEM_ID" \
  -f fieldId="PVTF_lADOC01-Rc4AtDz2zg0X7kk" \
  -f date="$TARGET_DATE"
```

## Workflow

### Draft Task 생성 후 자동 호출

`draft-task-creator` Agent가 Draft Task를 생성한 후 이 스킬을 호출합니다:

```yaml
trigger: draft_task_created
input:
  issue_number: 123
  repo: "semicolon-devteam/docs"
  effort: 3          # Estimation Point
  priority: "P2"     # 우선순위
  type: "태스크"      # 타입
```

### Bug 이슈 Point 할당

Bug 이슈 생성 후 Estimation Point를 할당할 때:

```yaml
trigger: bug_issue_estimation
input:
  issue_number: 456
  repo: "semicolon-devteam/core-backend"
  effort: 2          # 간단한 버그
```

## Option ID Reference

### 우선순위

| 값 | Option ID |
|----|-----------|
| P0(긴급) | `a20917be` |
| P1(높음) | `851dbd77` |
| P2(보통) | `e3b68a2a` |
| P3(낮음) | `2ba68eff` |
| P4(매우 낮음) | `746928cf` |

### 타입

| 값 | Option ID |
|----|-----------|
| 에픽 | `389a3389` |
| 버그 | `acbe6dfc` |
| 태스크 | `851de036` |

## Error Handling

### 권한 오류

```markdown
⚠️ **Projects 필드 설정 실패**

`project` scope 권한이 필요합니다.
다음 명령으로 권한을 추가해주세요:

\`\`\`bash
gh auth refresh -s project
\`\`\`
```

### Item ID 조회 실패

Issue가 아직 Project에 추가되지 않은 경우:

```markdown
⚠️ **Project Item을 찾을 수 없습니다**

Issue #{issue_number}가 '이슈관리' Project에 추가되어 있는지 확인해주세요.
```

## 완료 메시지

```markdown
[SEMO] Skill: set-project-field 완료

✅ GitHub Projects 필드 설정 완료

**Issue**: #{issue_number}
**필드**: {field_name}
**값**: {value}
```

## SEMO Message Format

```markdown
[SEMO] Skill: set-project-field 호출 - {필드명}

[SEMO] Skill: set-project-field 완료 - Issue #{issue_number}
```

## References

- [GitHub Projects GraphQL API](https://docs.github.com/en/graphql/reference/mutations#updateprojectv2itemfieldvalue)
- [create-epic Skill](../create-epic/skill.md) - Epic 생성 시 타입/우선순위 설정 참조
