# Error Handling

> spec-master Agent 오류 처리

## If speckit.specify Fails

```markdown
❌ Specification Failed

**Error**: [Error message from speckit.specify]

**Possible Causes**:
- Feature description too vague
- Branch creation issues
- Template file missing

**Resolution**:
1. Check feature description clarity
2. Verify git repository state
3. Ensure .specify/templates/spec-template.md exists
4. Try again with more detailed description
```

## If Plan/Tasks Fails

```markdown
❌ Planning/Tasks Failed

**Error**: [Error message]

**Resolution**:
1. Verify spec.md exists and is complete
2. Check for [NEEDS CLARIFICATION] markers
3. Run `/speckit.clarify` if needed
4. Retry the failed phase
```

## Common Error Patterns

### Vague Feature Description

**Error**: speckit.specify cannot determine scope

**Resolution**:
```markdown
Feature description is too vague. Please provide:
- Specific user action
- Expected behavior
- Domain context

Example: Instead of "Add notifications"
Use: "Add email notifications when user receives comment on their post"
```

### Branch Already Exists

**Error**: Git branch conflict

**Resolution**:
```bash
# Check existing branches
git branch -a | grep [feature-name]

# Options:
# A: Use existing branch
git checkout [existing-branch]

# B: Delete and recreate
git branch -D [branch-name]
/speckit.specify [feature]
```

### Spec Quality Validation Failure

**Error**: Spec does not meet quality checklist

**Resolution**:
```markdown
Spec quality issues detected:
- [ ] Missing acceptance criteria
- [ ] Unclear success metrics
- [ ] No error handling scenarios

Run `/speckit.clarify` to address these issues.
```

### Missing Dependencies

**Error**: spec-kit templates not found

**Resolution**:
```bash
# Verify .specify directory structure
ls -la .specify/

# Required structure:
# .specify/
# ├── templates/
# │   ├── spec-template.md
# │   ├── plan-template.md
# │   └── tasks-template.md
# └── memory/
#     └── constitution.md
```

## Recovery Procedures

### Partial Spec Recovery

If spec process was interrupted:

```bash
# Check current state
ls -la specs/[feature-name]/

# Determine which phase to resume
# - Only spec.md exists → Resume from Phase 2
# - spec.md + plan.md exist → Resume from Phase 3
# - All exist but incomplete → Run /speckit.clarify
```

### Clean Restart

If spec is corrupted or needs fresh start:

```bash
# Backup existing spec (if valuable)
mv specs/[feature-name] specs/[feature-name].bak

# Start fresh
/speckit.specify [feature-description]
```
