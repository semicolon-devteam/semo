# Task Finalization Workflow

## 1. GitHub Projects Field Update

For each Draft Task:

```markdown
[SAX] Skill: assign-estimation-point 사용
```

```bash
# Update Projects '작업량' field with Point value
gh api graphql -f query='...'
```

## 2. Auto-label Epic

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

## 3. Epic Timeline Estimation

```markdown
[SAX] Skill: estimate-epic-timeline 사용
```

Sum all Draft Tasks Points and add timeline comment to Epic.

## 4. Task Validation

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
- [ ] Projects field

**If validation fails**:
- Fill missing items
- Re-validate

## 5. Completion Report

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
