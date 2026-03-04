---
name: board
description: |
  GitHub Projects 보드 관리 및 상태 조회. Use when:
  (1) 프로젝트 현황 확인, (2) Task 상태 조회, (3) 보드 업데이트.
tools: [Bash, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: board 호출` 시스템 메시지를 첫 줄에 출력하세요.

# board Skill

> GitHub Projects 보드 관리 및 상태 조회

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **status** | 프로젝트 현황 조회 | "프로젝트 현황", "진행 상황" |
| **update** | Issue 상태 업데이트 | "상태 변경", "In Progress로" |
| **progress** | Task 진척도 조회 | "Task 진행률" |

---

## Action: status (프로젝트 현황)

### Workflow

```bash
# GitHub Projects 이슈 조회
gh project item-list 1 \
  --owner semicolon-devteam \
  --format json \
  | jq '.items[] | select(.status=="In Progress")'
```

### 출력

```markdown
[SEMO] Skill: board 완료 (status)

✅ 프로젝트 현황

**In Progress**: 8개
**Todo**: 12개
**Done**: 45개
**Total**: 65개
```

---

## Action: update (상태 변경)

### Workflow

```bash
# Issue 상태 변경
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwDOC01-Rc4AtDz2"
    itemId: "{ITEM_ID}"
    fieldId: "{STATUS_FIELD_ID}"
    value: { singleSelectOptionId: "{OPTION_ID}" }
  }) {
    projectV2Item { id }
  }
}'
```

### 출력

```markdown
[SEMO] Skill: board 완료 (update)

✅ Issue #123 상태 변경

**Before**: Todo
**After**: In Progress
```

---

## Related

- `sprint` - Sprint 관리
- `task` - Task 할당
- `issue` - Issue 생성
