# Phase Details Reference

## SDD Phase 상세

### Phase 1 - Specify

1. Run `/speckit.specify [feature-description]`
   - Create feature branch: `N-short-name`
   - Generate `specs/N-short-name/spec.md`
   - Validate quality

### Phase 2 - Clarify (Automatic)

2. Run `/speckit.clarify`
   - Analyze spec.md for underspecified areas
   - Generate up to 5 targeted clarification questions
   - Collect user answers
   - Update spec.md with clarifications
   - **Skip if**: No [NEEDS CLARIFICATION] markers found

### Phase 3 - Plan

3. Run `/speckit.plan`
   - Map requirements to DDD layers
   - Document technical approach
   - Create `specs/N-short-name/plan.md`

### Phase 4 - Checklist (Optional)

4. Ask user: "커스텀 체크리스트 생성할까요? (y/n)"
   - **yes** → Run `/speckit.checklist`
   - **no** → Skip to next phase

### Phase 5 - Tasks

5. Run `/speckit.tasks`
   - Break down plan into actionable tasks
   - Group by DDD layer
   - Create `specs/N-short-name/tasks.md`

### Phase 6 - Create Issues (Optional)

6. Ask user: "GitHub Issues로 변환할까요? (y/n)"
   - **yes** → Invoke `skill:create-issues`
   - **no** → Skip

### Phase 7 - Report Completion

7. Summarize all created artifacts

## Phase Flow Diagram

```
specify → clarify? → plan → checklist? → tasks → issues? → report
   ↓         ↓         ↓         ↓          ↓        ↓        ↓
 spec.md  (auto)   plan.md   (ask)    tasks.md   (ask)   summary
                                      checklist.md      GitHub
```

## Configuration Options

```yaml
# Agent can configure behavior
auto_clarify: true # Always run clarify (default: true)
auto_checklist: false # Skip checklist prompt (default: false)
auto_issues: false # Skip issues prompt (default: false)
```
