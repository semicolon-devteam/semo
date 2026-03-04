---
name: task
description: |
  Task 할당 및 시작. Use when:
  (1) Task 할당, (2) Task 시작, (3) 진행 상태 업데이트.
tools: [Bash, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: task 호출 - {action}` 시스템 메시지를 첫 줄에 출력하세요.

# task Skill

> Task 할당 및 시작 관리

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **assign** | Task 할당 | "Task 할당", "담당자 지정" |
| **start** | Task 시작 | "Task 시작", "작업 시작" |
| **update** | 진행 상태 업데이트 | "진행 중으로", "상태 변경" |

---

## Action: assign (할당)

### Workflow

```bash
# GitHub Issue 할당
gh issue edit {issue_number} \
  --add-assignee {username}

# Projects 보드에서 상태 변경
gh api graphql -f query='...'
```

### 출력

```markdown
[SEMO] Skill: task 완료 (assign)

✅ Task #123 할당 완료

**담당자**: @reus
**Epic**: #456
```

---

## Action: start (시작)

### Workflow

```
1. Task Issue 조회
2. AC (Acceptance Criteria) 확인
3. 브랜치 생성 (feat/{issue}-{feature})
4. Projects 상태 → "In Progress"
5. 알림 전송 (선택)
```

### 출력

```markdown
[SEMO] Skill: task 완료 (start)

✅ Task #123 시작

**브랜치**: feat/123-user-login
**상태**: In Progress
**AC**: 4개
```

---

## Related

- `board` - 보드 관리
- `git` - 브랜치 생성
- `sprint` - Sprint 관리
