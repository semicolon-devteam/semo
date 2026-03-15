---
name: semo-bot-status
description: "Sync bot online/offline status to semo Core DB on session start/stop"
metadata:
  openclaw:
    emoji: "🦀"
    events: ["command:new", "command:stop"]
    requires:
      bins: ["semo"]
      env: ["DATABASE_URL"]
---

# semo-bot-status Hook

OpenClaw 세션 시작/종료 시 semo Core DB의 `bot_status` 테이블을 업데이트합니다.

- `/new` (command:new) → `semo bots set-status designclaw online`
- `/stop` (command:stop) → `semo bots set-status designclaw offline`

## 요구사항

- `semo` CLI 전역 설치: `npm install -g @team-semicolon/semo-cli`
- `DATABASE_URL` 환경변수 설정 (SSH 터널 기반)
