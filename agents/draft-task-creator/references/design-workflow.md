# Design Task Workflow

## When Design is Needed

Check Epic's design field checkbox.

## Create Design Task

```markdown
[SAX] Skill: create-design-task 사용
```

Process:
1. Create design Task in service repository
2. Link as sub-issue to Epic
3. Apply `design` label
4. **Add to GitHub Projects** (필수)

## Task Structure

See create-design-task skill for complete structure.

## Add to GitHub Projects (필수)

생성된 Design Task를 `이슈관리` Projects (#1)에 등록:

```bash
# 1. Issue의 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{service_repo}/issues/{issue_number} \
  --jq '.node_id')

# 2. Projects에 추가
gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
' -f projectId="PVT_kwDOCr2fqM4A0TQd" -f contentId="$ISSUE_NODE_ID"
```

> **Note**: `PVT_kwDOCr2fqM4A0TQd`는 semicolon-devteam의 `이슈관리` Projects (#1) ID입니다.
