---
name: notify-slack
description: |
  Slack 알림 전송. Use when (1) "슬랙에 알려줘", "알림 보내줘",
  (2) 작업 완료 알림, (3) 에러 알림.
tools: [mcp__semo-integrations__slack_send_message]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: notify-slack 호출`

# notify-slack Skill

> Slack 알림 전송 자동화

## Trigger Keywords

- "슬랙에 알려줘", "알림 보내줘"
- "팀에 공유해줘"
- "완료 알림"

## 사용법

```
mcp__semo-integrations__slack_send_message
- text: "메시지 내용"
- channel: "#채널명" (선택)
```
