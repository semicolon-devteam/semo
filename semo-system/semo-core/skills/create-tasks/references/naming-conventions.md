# Issue Naming Conventions

## Title Format

```text
[Layer] Description
```

Examples:

- `[v0.0.x CONFIG] Check dependencies`
- `[v0.1.x PROJECT] Scaffold posts domain structure`
- `[v0.2.x TESTS] Write PostsRepository unit tests`
- `[v0.3.x DATA] Define Post and Comment models`
- `[v0.4.x CODE] Implement useComments hook`

## Label Conventions

### Layer Labels (required)

- `v0.0.x-config`
- `v0.1.x-project`
- `v0.2.x-tests`
- `v0.3.x-data`
- `v0.4.x-code`

### Domain Labels (required)

- `domain:posts`
- `domain:auth`
- `domain:dashboard`
- `domain:profile`

### Complexity Labels (optional)

- `complexity:simple` - Straightforward, < 1 hour
- `complexity:medium` - Moderate, 1-3 hours
- `complexity:complex` - Challenging, > 3 hours

### Type Labels (required)

- `task` - From tasks.md
- `bug` - Bug fix
- `feature` - New feature
- `epic` - Parent Epic

## Issue Body Structure

새로운 협업 중심 Issue Body 구조:

```markdown
## 📋 {task_description}

## 🔄 Speckit Progress

- [x] specify → [spec.md]({specs_url}/spec.md)
- [x] plan → [plan.md]({specs_url}/plan.md)
- [ ] checklist
- [x] tasks → [tasks.md]({specs_url}/tasks.md)
- [ ] implement

## 🎯 Acceptance Criteria

- [ ] AC 1
- [ ] AC 2

## 🧪 테스트 케이스

### 엔지니어 테스트

- [ ] 테스트 1: 예상 결과

### QA 테스트

| Step | Action | Expected |
|------|--------|----------|
| 1 | 동작 | 결과 |

## 📊 Metadata

| Field | Value |
|-------|-------|
| Layer | v0.x.x LAYER |
| Domain | domain |
| Epic | #epic_number |
| Depends on | #dep_issue |
```

> **Source of Truth**: specs/ 폴더가 상세 명세의 진실 소스. Issue는 협업 허브 역할.
