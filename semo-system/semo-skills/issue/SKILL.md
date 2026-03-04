---
name: issue
description: |
  GitHub Issue 생성 및 관리. Use when:
  (1) Issue 생성, (2) Issue 조회, (3) Issue 상태 변경.
tools: [Bash, mcp__github__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: issue 호출` 시스템 메시지를 첫 줄에 출력하세요.

# issue Skill

> GitHub Issue 생성 및 관리

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **create** | Issue 생성 | "Issue 만들어줘" |
| **list** | Issue 조회 | "Issue 목록" |
| **update** | Issue 상태 변경 | "Issue 닫아줘" |

---

## Action: create (Issue 생성)

### Workflow

```bash
# GitHub Issue 생성
gh issue create \
  --repo semicolon-devteam/docs \
  --title "{제목}" \
  --label "{라벨}" \
  --body "$(cat <<'EOF'
## 설명
{내용}

## AC (Acceptance Criteria)
- [ ] AC 1
- [ ] AC 2
EOF
)"

# Projects 연동
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/docs/issues/{issue_number} --jq '.node_id')
gh api graphql -f query='...' # Projects에 추가
```

### 출력

```markdown
[SEMO] Skill: issue 완료 (create)

✅ Issue 생성 완료

**Issue**: #123
**제목**: 사용자 인증 기능 추가
**라벨**: feature, backend
```

---

## Action: list (Issue 조회)

### Workflow

```bash
# Issue 목록 조회
gh issue list \
  --repo semicolon-devteam/docs \
  --label "feature" \
  --state open \
  --limit 10
```

---

## Action: update (Issue 상태 변경)

### Workflow

```bash
# Issue 닫기
gh issue close {issue_number}

# 라벨 추가
gh issue edit {issue_number} --add-label "resolved"
```

---

## Related

- `epic` - Epic 생성
- `task` - Task 관리
- `board` - 보드 관리
