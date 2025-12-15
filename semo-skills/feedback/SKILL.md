---
name: feedback
description: |
  피드백 관리. Use when (1) "피드백 등록해줘", "버그 신고",
  (2) GitHub 이슈 생성, (3) 피드백 확인.
tools: [mcp__semo-integrations__github_create_issue, Bash]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: feedback 호출`

# feedback Skill

> 피드백 및 이슈 관리

## Trigger Keywords

- "피드백 등록해줘", "버그 신고"
- "이슈 만들어줘"
- "피드백 확인해줘"

## 이슈 생성

```
mcp__semo-integrations__github_create_issue
- repo: "semicolon-devteam/semo"
- title: "이슈 제목"
- body: "이슈 내용"
- labels: "bug" 또는 "enhancement"
```
