---
name: create-epic
description: Create Epic issue in docs repository. Use when (1) epic-master needs to create new Epic from PO/기획자 requirements, (2) migrating Epic from another repository, (3) converting requirements into GitHub Issue with epic-template.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: create-epic 호출 - {Epic 제목}` 시스템 메시지를 첫 줄에 출력하세요.

# create-epic Skill

> Epic 이슈를 docs 레포지토리에 생성하는 스킬

## 개요

PO/기획자가 정의한 요구사항을 GitHub Issue로 생성합니다.

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

# 2. GitHub Issue 생성
gh issue create \
  --repo semicolon-devteam/docs \
  --title "[Epic] {DOMAIN_NAME} · {short_description}" \
  --body "{rendered_template}" \
  --label "epic"

# 3. Projects 연동 + 타입/우선순위 설정 (필수)
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

# 3-2. 🔴 타입 필드를 "에픽"으로 설정 (필수)
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
  -f optionId="389a3389"

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
```

> **Note**: `PVT_kwDOC01-Rc4AtDz2`는 `이슈관리` Projects (#1) ID입니다.
>
> **타입 옵션**: 에픽(`389a3389`), 버그(`acbe6dfc`), 태스크(`851de036`) - [priority-config.md](../common/priority-config.md) 참조

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

- [Epic Template](../templates/epic-template.md)
- [epic-master Agent](../agents/epic-master.md)

## References

For detailed documentation, see:

- [Workflow](references/workflow.md) - 입력 스키마, 상세 동작 프로세스
- [Output Format](references/output-format.md) - 성공 출력, 에러 처리
- [Dev Checklist](references/dev-checklist.md) - 개발자 관점 질문 체크리스트
