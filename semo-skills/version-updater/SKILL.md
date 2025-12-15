---
name: version-updater
description: |
  버전 체크 및 업데이트 알림. Use when (1) "버전 체크해줘",
  (2) "업데이트 확인", (3) SEMO 버전 확인.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: version-updater 호출`

# version-updater Skill

> 버전 체크 및 업데이트 알림

## Trigger Keywords

- "버전 체크해줘", "버전 확인"
- "업데이트 있는지 확인"
- "SEMO 버전"

## 체크 명령

```bash
# 현재 버전
semo --version

# npm 최신 버전
npm view @team-semicolon/semo-cli version
```
