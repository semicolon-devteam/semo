---
name: list-bugs
description: |
  버그 목록 조회. Use when (1) "버그 목록", "이슈 목록",
  (2) open 버그 확인, (3) 우선순위 버그 확인.
tools: [Bash]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: list-bugs 호출`

# list-bugs Skill

> GitHub 버그/이슈 목록 조회

## Trigger Keywords

- "버그 목록", "이슈 목록"
- "open 버그 뭐 있어"
- "해결해야 할 버그"

## 조회 명령

```bash
gh api repos/semicolon-devteam/semo/issues \
  --jq '.[] | select(.state == "open") | "- #\(.number) \(.title)"'
```
