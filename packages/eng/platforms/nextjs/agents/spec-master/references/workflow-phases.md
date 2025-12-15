# Workflow Phases

> spec-master Agent SDD Phase 1-3 상세 워크플로우

## Step 1: Understand User Intent

When user types `/spec [feature-description]`, extract:

- Feature description (required)
- Domain context (if mentioned)
- Any specific requirements or constraints

**Examples**:
- `/spec Add real-time notifications for post comments`
- `/spec Implement OAuth2 authentication for dashboard`
- `/spec Create analytics dashboard with user activity tracking`

## Step 2: Execute SDD Phase 1 - Specify

```bash
/speckit.specify [feature-description]
```

**What this does**:
- Generates feature short-name (e.g., "realtime-notifications")
- Creates feature branch: `N-short-name`
- Creates `specs/N-short-name/spec.md`
- Runs quality validation checklist
- Handles [NEEDS CLARIFICATION] with user

**Wait for**: spec.md creation confirmation before proceeding

## Step 3: Execute SDD Phase 2 - Plan

```bash
/speckit.plan
```

**What this does**:
- Reads spec.md requirements
- Maps to DDD layers (Repository, API Client, Hooks, Components)
- Defines technical stack and constraints
- Documents architecture decisions
- Creates `specs/N-short-name/plan.md`

**Wait for**: plan.md creation confirmation before proceeding

## Step 4: Execute SDD Phase 3 - Tasks

```bash
/speckit.tasks
```

**What this does**:
- Breaks down plan into actionable chunks
- Groups tasks by DDD layer
- Marks parallelizable tasks with [P]
- Defines test requirements per task
- Creates `specs/N-short-name/tasks.md`
- **Includes "## GitHub Issues" section** for sync-tasks integration

**Wait for**: tasks.md creation confirmation

**Post-tasks Automation** (spec-master responsibility):

After `/speckit.tasks` completes, spec-master must:

1. Check if tasks.md includes "## GitHub Issues" section
2. If missing, append the section:

```markdown
## GitHub Issues

<!-- sync-tasks will populate this section -->
<!-- Format: - [x] #123 Task description [link](url) -->
```

3. Inform user about sync-tasks availability:

```markdown
✅ tasks.md created successfully

**Next Step**: Run `sync-tasks` skill to create GitHub Issues:
- Converts tasks.md → GitHub Issues
- Updates this section with links
- Ready for team tracking
```

## Step 5: Verify Completeness

After all three phases complete, verify:

```bash
# Check all spec files exist
ls -la specs/[N-short-name]/

# Should show:
# spec.md   ✅ (Feature requirements)
# plan.md   ✅ (Technical approach)
# tasks.md  ✅ (Work breakdown)
```

## Step 6: Report Completion

Provide summary to user:

```markdown
✅ Specification Complete: [Feature Name]

**Created Files**:
- spec.md: Feature requirements and acceptance criteria
- plan.md: Technical approach and DDD mapping
- tasks.md: Actionable work items grouped by layer

**Branch**: [N-short-name]
**Location**: specs/[N-short-name]/

**Next Steps**:
1. Review spec.md for completeness
2. If clarifications needed: `/speckit.clarify`
3. Create GitHub Issues: Use `sync-tasks` skill (converts tasks.md → GitHub Issues)
4. Ready to implement: `/implement [domain]:[feature]`
5. Or run individual spec-kit commands for targeted updates

**Quick Commands**:
- `/speckit.clarify` - Resolve spec ambiguities
- `/speckit.analyze` - Cross-artifact consistency check
- `sync-tasks` - Create GitHub Issues from tasks.md
- `/implement` - Start ADD implementation phases
```
