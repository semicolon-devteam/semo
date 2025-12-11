# Complete Draft Task Workflow

> Draft Task → 완성된 Task 변환 상세 워크플로우

## Phase 1: Draft Task 조회

### Step 1.1: Issue 정보 수집

```bash
# Draft Task 정보 조회
gh issue view {issue-number} --json title,body,labels,assignees

# 여러 Issue 일괄 조회
gh issue list --label draft --json number,title,labels
```

### Step 1.2: 현재 상태 분석

확인 항목:

- `draft` 라벨 존재 여부
- 본문 내용 (비어있거나 minimal)
- Epic 연결 상태
- Assignee 설정 여부

## Phase 2: spec.md 기반 AC 생성

### Step 2.1: spec.md 파싱

```markdown
## Acceptance Criteria 추출 패턴

spec.md 내 다음 섹션에서 추출:
- ## Acceptance Criteria
- ## Requirements
- ### Functional Requirements
```

### Step 2.2: Task별 AC 매핑

tasks.md의 Task ID와 spec.md의 AC를 매핑:

```markdown
Task 1.1 (Scaffold domain) → AC from "Project Setup" section
Task 2.1 (Repository tests) → AC from "Testing Requirements" section
```

## Phase 3: Issue 업데이트

### Step 3.1: 라벨 업데이트

```bash
# draft 라벨 제거
gh issue edit {number} --remove-label "draft"

# 필요한 라벨 추가
gh issue edit {number} --add-label "task,v0.1.x-project,domain:posts"
```

### Step 3.2: 본문 업데이트

```bash
gh issue edit {number} --body "$(cat <<'EOF'
## 📋 Task Description

[Task description from tasks.md]

## 🎯 Acceptance Criteria

- [ ] [AC 1 from spec.md]
- [ ] [AC 2 from spec.md]
- [ ] [AC 3 from spec.md]

## 🔗 Dependencies

Depends on: #[previous-issue]

## 📊 Metadata

- **Layer**: [CONFIG | PROJECT | TESTS | DATA | CODE]
- **Complexity**: [Simple | Medium | Complex]
- **Estimation**: [Story Points]
- **Epic**: #[epic-number]
EOF
)"
```

### Step 3.3: Epic 연결

```bash
# GitHub Projects를 통한 Epic 연결 (조직/레포에 따라 다름)
gh issue edit {number} --milestone "{milestone-name}"

# 또는 본문에 Epic 참조 추가
```

## Phase 4: 검증 및 보고

### Step 4.1: 변환 검증

각 Issue에 대해 확인:

- [ ] `draft` 라벨 제거됨
- [ ] `task` 라벨 추가됨
- [ ] AC 섹션 존재
- [ ] Dependencies 명시
- [ ] Epic 연결됨

### Step 4.2: 보고 생성

```markdown
## ✅ Complete Draft Task 완료

| Issue | Title | Labels | AC | Epic |
|-------|-------|--------|-----|------|
| #145 | Check dependencies | task, v0.0.x-config | 3 | #144 |
| #146 | Scaffold domain | task, v0.1.x-project | 4 | #144 |
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Issue not found | Issue 번호 확인, 레포 확인 |
| Permission denied | gh auth 상태 확인 |
| Draft label missing | 이미 변환된 Issue로 판단, skip |
| spec.md not found | specFile 경로 확인 |
