---
name: draft-task-creator
description: Generate Draft Task Issues from Epic automatically. Use when (1) creating draft tasks from Epic (triggers on "Draft Task 생성해줘"), (2) Epic creation is complete and needs task breakdown, (3) Epic URL is provided for task generation. Creates backend, frontend, and design tasks with AC, estimation, and validation.
---

# Draft Task Creator

Auto-generate Draft Task Issues from Epic with complete AC, estimation, and validation.

## Quick Start

```
Read Epic → Analyze (backend/frontend/design) → Create Tasks → Validate → Report
```

## Preconditions

Required:
1. Epic Issue URL or number
2. Target repository specified in Epic
3. Epic design field checked (if design needed)

## Workflows

**For detailed workflows, see**:
- [Backend Workflow](references/backend-workflow.md) - Backend task creation with duplication check
- [Frontend Workflow](references/frontend-workflow.md) - Frontend task creation
- [Design Workflow](references/design-workflow.md) - Design task creation
- [Finalization](references/finalization.md) - Projects field update, labels, validation

## Workflow Summary

### 0. Check Preconditions
- Epic URL/number
- Target repo specified
- Design field status

### 1. Read and Analyze Epic
```bash
gh api repos/semicolon-devteam/docs/issues/{epic_number}
```

Parse:
- User Stories
- Target repository
- Design requirements
- Acceptance criteria

### 2. Backend Tasks
- Check duplication (check-backend-duplication skill)
- Create if no duplicate
- Link sub-issue, apply draft label

### 3. Frontend Tasks
- Create in service repo
- Link sub-issue, apply draft label

### 4. Design Tasks
- create-design-task skill if needed

### 5. Finalization
- Projects field update (assign-estimation-point)
- Auto-label Epic (auto-label-by-scope)
- Timeline estimation (estimate-epic-timeline)
- Validation (validate-task-completeness)

## Error Handling

**No Epic URL**:
```markdown
⚠️ **Epic URL이 필요합니다**

Epic Issue URL 또는 번호를 제공해주세요.
```

**No Target Repo**:
```markdown
⚠️ **대상 레포지토리가 Epic에 명시되지 않았습니다**

Epic 본문의 "📦 대상 레포지토리" 섹션을 확인하고 체크해주세요.
```

## Best Practices

1. **Epic Analysis**: Carefully analyze User Stories for complete task coverage
2. **Duplicate Prevention**: Always check core-backend duplication
3. **Completeness**: Include AC, Estimation, Branch name in all tasks
4. **Consistency**: Follow naming conventions (`[Backend]`, `[Frontend]`, `[Design]`)
5. **Validation**: Final check with validate-task-completeness

## Related

- [epic-master Agent](../epic-master/SKILL.md)
- [Skills Directory](../../skills/)
