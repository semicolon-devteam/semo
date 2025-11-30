# Task Finalization Workflow

## 1. Add to GitHub Projects (필수)

모든 Draft Task를 `이슈관리` Projects (#1)에 등록:

```bash
# 1. Issue의 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{repo}/issues/{issue_number} \
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

## 2. GitHub Projects Field Update

For each Draft Task:

```markdown
[SAX] Skill: assign-estimation-point 사용
```

```bash
# Update Projects '작업량' field with Point value
gh api graphql -f query='...'
```

## 3. Auto-label Epic

```markdown
[SAX] Skill: auto-label-by-scope 사용
```

```bash
# Add automatic labels to Epic:
# backend, frontend, design, fullstack
gh api repos/semicolon-devteam/docs/issues/{epic_number}/labels \
  -f labels[]="fullstack" \
  -f labels[]="design"
```

## 4. Epic Timeline Estimation

```markdown
[SAX] Skill: estimate-epic-timeline 사용
```

Sum all Draft Tasks Points and add timeline comment to Epic.

## 5. Task Validation

For each Draft Task:

```markdown
[SAX] Skill: validate-task-completeness 사용
```

Check required items:
- [ ] AC (Acceptance Criteria)
- [ ] Estimation
- [ ] Branch name
- [ ] draft label
- [ ] Epic Sub-issue relationship
- [ ] **Projects 등록** (이슈관리 #1)

**If validation fails**:
- Fill missing items
- Re-validate

## 6. Completion Report

```markdown
## ✅ Draft Tasks 생성 완료

### 📋 생성된 Tasks

**Backend** (core-backend):
- [#123] 사용자 차단 API 구현 (8 Points)

**Frontend** (cm-introduction-new):
- [#456] 사용자 차단 UI 구현 (10 Points)

**Design**:
- [#789] 사용자 차단 화면 디자인 (3 Points)

### 📊 전체 일정 예측

**총 작업량**: 21 Points
**예상 기간**: 10.5일 (약 2주)

### 🏷️ Epic 라벨

- `fullstack`
- `design`

### ✅ 검증 결과

모든 Draft Tasks가 필수 항목을 포함하고 있습니다.
```
