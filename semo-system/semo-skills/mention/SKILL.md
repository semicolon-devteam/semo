---
name: mention
description: |
  팀원 멘션 및 알림. Use when:
  (1) Slack 멘션, (2) GitHub 멘션, (3) 담당자 호출.
tools: [Bash, mcp__*]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: mention 호출` 시스템 메시지를 첫 줄에 출력하세요.

# mention Skill

> 팀원 멘션 및 알림

## Platforms

| Platform | 방법 | 형식 |
|----------|------|------|
| **Slack** | Slack API | `<@USER_ID>` |
| **GitHub** | Issue/PR 코멘트 | `@username` |

---

## Action: Slack 멘션

### Workflow

```bash
# 1. Slack User ID 조회
/tmp/slack_users.sh "{TOKEN}" | \
  jq -r '.members[] | select(.profile.display_name | test("이름"; "i")) | .id'

# 2. 메시지 전송 (멘션 포함)
curl -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$CHANNEL_ID\",
    \"text\": \"<@$USER_ID> 확인 부탁드립니다\"
  }"
```

---

## Action: GitHub 멘션

### Workflow

```bash
# Issue 코멘트로 멘션
gh issue comment {issue_number} \
  --body "@username 리뷰 부탁드립니다"

# PR 리뷰 요청
gh pr edit {pr_number} \
  --add-reviewer username
```

---

## 출력

```markdown
[SEMO] Skill: mention 완료

✅ 멘션 전송 완료

**Platform**: Slack
**대상**: @reus
**메시지**: Task #123 확인 부탁드립니다
```

---

## Related

- `notify` - 알림 전송
- `task` - Task 할당
- `review` - 리뷰 요청
