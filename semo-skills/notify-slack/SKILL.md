---
name: notify-slack
description: |
  Slack 알림 전송. Use when (1) "슬랙에 알려줘", "알림 보내줘",
  (2) 작업 완료 알림, (3) 에러 알림.
tools: [mcp__semo-integrations__slack_send_message]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: notify-slack` 시스템 메시지를 첫 줄에 출력하세요.

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
