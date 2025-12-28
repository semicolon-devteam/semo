# Slack 알림 메시지 형식

## Block Kit 구조

```json
{
  "channel": "#_협업",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📋 *Task 할당 알림*\n\n<@{slack_id}> 님에게 새 Task가 할당되었습니다."
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Task*\n<{issue_url}|#{number} {title}>"
        },
        {
          "type": "mrkdwn",
          "text": "*작업량*\n{estimate}pt ({size} - {duration})"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "할당자: {assigner} | {timestamp}"
        }
      ]
    }
  ]
}
```

## 메시지 예시

```
📋 Task 할당 알림

@kyago 님에게 새 Task가 할당되었습니다.

Task                              작업량
#123 댓글 기능 구현               3pt (M - 1일)

할당자: @Reus | 2025-12-01 14:30
```
