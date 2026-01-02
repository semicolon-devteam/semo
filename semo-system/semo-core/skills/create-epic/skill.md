---
name: create-epic
description: |
  Create Epic issue in docs repository. Use when (1) ideate 스킬에서 자동 호출,
  (2) epic-master needs to create new Epic, (3) Design Brief → Epic 변환,
  (4) converting requirements into GitHub Issue.
tools: [Bash, Read, GitHub CLI]
---

> **시스템 메시지**: `[SEMO] Skill: create-epic 호출 - {Epic 제목}`

# create-epic Skill

> Epic 이슈를 docs 레포지토리에 생성하는 스킬

## 개요

Design Brief 또는 PO/기획자 요구사항을 GitHub Epic Issue로 생성합니다.

## 호출 방식

| 호출자 | 입력 | 특징 |
|--------|------|------|
| `ideate` 스킬 | Design Brief + dev-checklist | 자동 연계, 검증 완료 상태 |
| `epic-master` 에이전트 | 요구사항 정보 | 수동 정보 수집 |
| 직접 호출 | 사용자 입력 | dev-checklist 수동 검증 |

## 🔴 개발자 관점 체크리스트 (필수)

> **Epic 생성 전 반드시 [dev-checklist.md](references/dev-checklist.md)를 검토합니다.**

Epic 작성 시 개발자가 구현 단계에서 할 질문들을 사전에 점검:

| 카테고리 | 핵심 질문 |
|----------|----------|
| 데이터 흐름 | 충돌 해결? 멀티플랫폼 동기화? |
| 시간/계산 | 집계 기준? 일할 계산? |
| 플랫폼 제약 | PWA/웹/네이티브 제약사항? |
| 도메인 지식 | 업계 표준? 엣지 케이스? |

**체크리스트 미검토 시 Epic 생성 금지**

## 트리거

- `epic-master` 에이전트에서 호출
- 명시적 호출: `skill:create-epic`

## Quick Start

```bash
# 1. 템플릿 로드
.claude/semo-po/templates/epic-template.md

# 2. GitHub Issue 생성 (프로젝트명 라벨 사용)
# 🔴 기술영역 라벨(epic, frontend, backend) 대신 프로젝트명 라벨 사용
gh issue create \
  --repo semicolon-devteam/docs \
  --title "[Epic] {DOMAIN_NAME} · {short_description}" \
  --body "{rendered_template}" \
  --label "{project_label}"

# 프로젝트명 라벨 예시: 차곡, 노조관리, 랜드, 오피스, 코인톡, 공통

# 3. Projects 연동 + Issue Type/우선순위 설정 (필수)
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/docs/issues/{issue_number} --jq '.node_id')

# 3-1. Projects에 Item 추가 및 Item ID 획득
ITEM_ID=$(gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" -f contentId="$ISSUE_NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')

# 🔴 Projects 연동 검증 (필수)
if [ -z "$ITEM_ID" ]; then
  echo "❌ Projects 연동 실패. gh auth refresh -s project 실행 후 재시도 필요"
  exit 1
fi

# 3-2. 🔴 GitHub Issue Type을 "Epic"으로 설정 (필수)
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "IT_kwDOC01-Rc4BvVz5"
    }) {
      issue { id title }
    }
  }
'

# 3-3. 우선순위 필드 설정
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
  -f optionId="{priority_option_id}"

# 3-4. 🔴 Status 필드를 "검수대기"로 설정 (#15 필수)
STATUS_RESULT=$(gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
}')

STATUS_FIELD_ID=$(echo "$STATUS_RESULT" | jq -r '.data.organization.projectV2.field.id')
STATUS_OPTION_ID=$(echo "$STATUS_RESULT" | jq -r '.data.organization.projectV2.field.options[] | select(.name == "검수대기") | .id')

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
  -f fieldId="$STATUS_FIELD_ID" \
  -f optionId="$STATUS_OPTION_ID"
```

> **Note**: `PVT_kwDOC01-Rc4AtDz2`는 `이슈관리` Projects (#1) ID입니다.
>
> **GitHub Issue Type**: Epic(`IT_kwDOC01-Rc4BvVz5`), Bug(`IT_kwDOC01-Rc4BdOuc`), Task(`IT_kwDOC01-Rc4BdOub`), Feature(`IT_kwDOC01-Rc4BdOud`)

## 우선순위 옵션

| 우선순위 | Option ID | 설명 |
|----------|-----------|------|
| P0(긴급) | `a20917be` | 즉시 처리 필요 |
| P1(높음) | `851dbd77` | 이번 스프린트 내 |
| P2(보통) | `e3b68a2a` | 일반 백로그 **(기본값)** |
| P3(낮음) | `2ba68eff` | 여유 있을 때 |
| P4(매우 낮음) | `746928cf` | 나중에 |

> 우선순위 미지정 시 **P2(보통)** 을 기본값으로 사용합니다.

## 제약 사항

- docs 레포지토리에만 Epic 생성
- 기술 상세는 포함하지 않음
- **Projects 연동은 필수** (실패 시 재시도 필요)

## SEMO Message

```markdown
[SEMO] Skill: create-epic 사용
```

## Related

- `ideate` - 아이디어 탐색 → Epic 원스톱 워크플로우 (이 스킬 자동 호출)
- `epic-master` Agent - 요구사항 수집 후 이 스킬 호출
- [Epic Template](../templates/epic-template.md)

## References

- [Workflow](references/workflow.md) - 입력 스키마, 상세 동작 프로세스
- [Output Format](references/output-format.md) - 성공 출력, 에러 처리
- [Dev Checklist](references/dev-checklist.md) - 개발자 관점 질문 체크리스트
