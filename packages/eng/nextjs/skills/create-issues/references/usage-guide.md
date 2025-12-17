# Create Issues Usage Guide

## Usage Examples

```javascript
// After tasks.md generation (from skill:spec)
skill: create-issues({
  tasksFile: "specs/5-post-likes/tasks.md",
  epic: 144, // Optional: auto-detect if omitted
});

// Standalone conversion
skill: create-issues({
  tasksFile: "specs/7-notifications/tasks.md",
  createEpic: true, // Create new Epic if none exists
});

// With custom labels
skill: create-issues({
  tasksFile: "specs/9-search/tasks.md",
  labels: ["priority:high", "team:frontend"],
});
```

## Output Format

````markdown
# GitHub Issues Creation Report

**Feature**: Add comment functionality
**Tasks File**: specs/5-comments/tasks.md
**Date**: 2025-01-20

---

## Summary

✅ **15 issues created** from 15 tasks
🔗 **Epic #144** linked
📋 **tasks.md** updated with issue references

---

## Created Issues

### v0.0.x CONFIG (1 issue)

- **#145**: Check dependencies
  - Labels: `v0.0.x-config`, `domain:posts`, `task`
  - URL: https://github.com/semicolon-devteam/cm-template/issues/145

### v0.1.x PROJECT (1 issue)

- **#146**: Scaffold domain structure
  - Labels: `v0.1.x-project`, `domain:posts`, `task`
  - Depends on: #145
  - URL: https://github.com/semicolon-devteam/cm-template/issues/146

### v0.2.x TESTS (3 issues)

- **#147**: Write Repository tests
  - Labels: `v0.2.x-tests`, `domain:posts`, `complexity:medium`, `task`
  - Depends on: #146
  - URL: https://github.com/semicolon-devteam/cm-template/issues/147

- **#148**: Write Hooks tests
  - Labels: `v0.2.x-tests`, `domain:posts`, `complexity:medium`, `task`
  - Depends on: #146
  - URL: https://github.com/semicolon-devteam/cm-template/issues/148

- **#149**: Write Component tests
  - Labels: `v0.2.x-tests`, `domain:posts`, `complexity:simple`, `task`
  - Depends on: #146
  - URL: https://github.com/semicolon-devteam/cm-template/issues/149

### v0.3.x DATA (1 issue)

- **#150**: Define models and types
  - Labels: `v0.3.x-data`, `domain:posts`, `task`
  - Depends on: #146
  - URL: https://github.com/semicolon-devteam/cm-template/issues/150

### v0.4.x CODE (9 issues)

- **#151**: Implement Repository layer
  - Labels: `v0.4.x-code`, `domain:posts`, `complexity:complex`, `task`
  - Depends on: #147, #150
  - URL: https://github.com/semicolon-devteam/cm-template/issues/151

- **#152**: Implement API Client layer
  - Labels: `v0.4.x-code`, `domain:posts`, `complexity:medium`, `task`
  - Depends on: #146
  - URL: https://github.com/semicolon-devteam/cm-template/issues/152

- **#153**: Implement Hooks layer
  - Labels: `v0.4.x-code`, `domain:posts`, `complexity:medium`, `task`
  - Depends on: #148, #152
  - URL: https://github.com/semicolon-devteam/cm-template/issues/153

- **#154-#159**: Implement Components (6 standard)
  - Labels: `v0.4.x-code`, `domain:posts`, `complexity:simple`, `task`
  - Depends on: #149, #153
  - URLs: [list of 6 URLs]

---

## Epic Integration

**Epic**: #144 - Add comment functionality
**Project Board**: Semicolon Community Template
**Milestone**: v1.0

All issues linked to Epic for tracking.

---

## Projects Integration (필수)

모든 생성된 Issue는 `이슈관리` Projects (#1)에 자동 등록됩니다.

**Projects ID**: `PVT_kwDOCr2fqM4A0TQd`

✅ **15 issues** added to Projects

---

## Updated Files

**specs/5-comments/tasks.md**:

```diff
+ ## GitHub Issues
+
+ Created 15 issues for this feature:
+ - #145: CONFIG - Check dependencies
+ - #146: PROJECT - Scaffold domain structure
+ ...
+
### 1.1 Scaffold domain structure (Issue #146)
```
````

## GitHub CLI Commands Used

```bash
# Create Epic (if needed)
gh issue create --title "Add comment functionality" \
  --label "epic" --body "..."

# Create task issues
gh issue create --title "[v0.1.x PROJECT] Scaffold domain structure" \
  --label "v0.1.x-project,domain:posts,task" \
  --body "..." \
  --assignee "@me"

# Link to Epic
gh issue edit 146 --add-field "Epic=#144"

# Add dependencies (via body text)

# Add to Projects (필수)
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{repo}/issues/{issue_number} \
  --jq '.node_id')

gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item { id }
    }
  }
' -f projectId="PVT_kwDOCr2fqM4A0TQd" -f contentId="$ISSUE_NODE_ID"
```

---

## Next Steps

1. **View All Issues**: https://github.com/semicolon-devteam/cm-template/issues?q=is%3Aissue+label%3Atask+is%3Aopen
2. **Project Board**: https://github.com/orgs/semicolon-devteam/projects/[board-id]
3. **Start Implementation**: Begin with issue #145
4. **Track Progress**: Close issues as tasks complete
