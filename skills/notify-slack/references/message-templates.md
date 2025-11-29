# Slack Message Templates

> notify-slack Skill에서 사용하는 Slack Block Kit 메시지 템플릿

## Draft Task 알림 템플릿

### 기본 템플릿

```json
{
  "channel": "{channel_id}",
  "text": "📋 새로운 Draft Task가 생성되었습니다",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 새로운 Draft Task가 생성되었습니다",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Epic*\n<{epic_url}|#{epic_number} {epic_title}>"
        },
        {
          "type": "mrkdwn",
          "text": "*프로젝트*\n{project_name}"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Draft Tasks*"
      }
    }
  ]
}
```

### Task 항목 블록 (반복)

```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "• <{task_url}|#{task_number} {task_title}> - {assignee_mention} ({points} Points)"
  }
}
```

**assignee_mention 형식**:
- Slack ID 있음: `<@U0XXXXXXX>`
- Slack ID 없음: `@{github_id}`

### Footer 블록

```json
{
  "type": "context",
  "elements": [
    {
      "type": "mrkdwn",
      "text": "spec 검토 후 구현을 시작해주세요! 🚀"
    }
  ]
}
```

## 변수 치환 규칙

| 변수 | 설명 | 예시 |
|------|------|------|
| `{channel_id}` | Slack 채널 ID 또는 이름 | `#_협업` |
| `{epic_url}` | Epic Issue URL | `https://github.com/semicolon-devteam/docs/issues/123` |
| `{epic_number}` | Epic Issue 번호 | `123` |
| `{epic_title}` | Epic 제목 | `댓글 기능 개선` |
| `{project_name}` | 프로젝트 이름 | `오피스` |
| `{task_url}` | Task Issue URL | `https://github.com/.../issues/456` |
| `{task_number}` | Task Issue 번호 | `456` |
| `{task_title}` | Task 제목 | `댓글 CRUD API 구현` |
| `{assignee_mention}` | 담당자 멘션 | `<@U0XXXXXXX>` |
| `{points}` | Estimation Points | `8` |

## 전체 메시지 예시

```json
{
  "channel": "#_협업",
  "text": "📋 새로운 Draft Task가 생성되었습니다",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 새로운 Draft Task가 생성되었습니다",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Epic*\n<https://github.com/semicolon-devteam/docs/issues/123|#123 댓글 기능 개선>"
        },
        {
          "type": "mrkdwn",
          "text": "*프로젝트*\n오피스"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Draft Tasks*"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "• <https://github.com/semicolon-devteam/core-backend/issues/456|#456 댓글 CRUD API 구현> - <@U0BACKEND1> (8 Points)"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "• <https://github.com/semicolon-devteam/cm-introduction-new/issues/789|#789 댓글 UI 컴포넌트> - <@U0FRONTEND1> (10 Points)"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "spec 검토 후 구현을 시작해주세요! 🚀"
        }
      ]
    }
  ]
}
```

## curl 명령어 템플릿

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#_협업",
    "text": "📋 새로운 Draft Task가 생성되었습니다",
    "blocks": [
      ... (위 블록들)
    ]
  }'
```

## Block Kit Builder

메시지 미리보기 및 수정:
- https://app.slack.com/block-kit-builder
