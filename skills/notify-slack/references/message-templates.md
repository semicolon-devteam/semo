# Slack Message Templates

> notify-slack Skill에서 사용하는 Slack Block Kit 메시지 템플릿

## 릴리스 알림 템플릿

### 기본 템플릿

```json
{
  "channel": "#_협업",
  "text": "🚀 SAX 패키지 업데이트",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚀 SAX 패키지 업데이트",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*패키지*\n{package_name}"
        },
        {
          "type": "mrkdwn",
          "text": "*버전*\n`v{version}`"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*변경 내역*\n{changelog_summary}"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "🔗 <https://github.com/semicolon-devteam/{package_name}|GitHub>"
        }
      ]
    }
  ]
}
```

### 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `{package_name}` | 패키지 이름 | `sax-po` |
| `{version}` | 새 버전 | `0.16.0` |
| `{changelog_summary}` | CHANGELOG 요약 | `• report-bug: 버그 리포트 추가` |

## 이슈/태스크 알림 템플릿

### 기본 템플릿

```json
{
  "channel": "#_협업",
  "text": "📋 새로운 이슈가 생성되었습니다",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 새로운 이슈가 생성되었습니다",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*컨텍스트*\n<{context_url}|#{context_number} {context_title}>"
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
        "text": "*이슈 목록*"
      }
    }
  ]
}
```

### 이슈 항목 블록 (반복)

```json
{
  "type": "section",
  "text": {
    "type": "mrkdwn",
    "text": "• <{issue_url}|#{issue_number} {issue_title}> - {assignee_mention}"
  }
}
```

### Footer 블록

```json
{
  "type": "context",
  "elements": [
    {
      "type": "mrkdwn",
      "text": "구현을 시작해주세요! 🚀"
    }
  ]
}
```

## 커스텀 메시지 템플릿

```json
{
  "channel": "{channel}",
  "text": "{plain_text_fallback}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "{message_with_mentions}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📋 *이슈*: <{issue_url}|#{issue_number} {issue_title}>"
      }
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
  -d '@message.json'
```

## Block Kit Builder

메시지 미리보기 및 수정:
- https://app.slack.com/block-kit-builder
