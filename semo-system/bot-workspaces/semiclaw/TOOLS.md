# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## 봇 OpenClaw 홈 디렉토리
| 봇 | 홈 디렉토리 | workspace (git repo 직접 참조) |
|---|---|---|
| SemiClaw | `~/.openclaw` + `~/.openclaw-semiclaw` | `semo-system/bot-workspaces/semiclaw` |
| WorkClaw | `~/.openclaw-workclaw` | `semo-system/bot-workspaces/workclaw` |
| PlanClaw | `~/.openclaw-planclaw` | `semo-system/bot-workspaces/planclaw` |
| ReviewClaw | `~/.openclaw-reviewclaw` | `semo-system/bot-workspaces/reviewclaw` |
| DesignClaw | `~/.openclaw-designclaw` | `semo-system/bot-workspaces/designclaw` |
| GrowthClaw | `~/.openclaw-growthclaw` | `semo-system/bot-workspaces/growthclaw` |
| InfraClaw | `~/.openclaw-infraclaw` | `semo-system/bot-workspaces/infraclaw` |

## 소스코드 경로
- Semicolon 프로젝트 루트: `/Users/reus/Desktop/Sources/semicolon`
- 개별 프로젝트: `/Users/reus/Desktop/Sources/semicolon/projects`
- 랜드 서비스 (게임랜드/플레이랜드/오피스/core-backend/ms-point-exchanger): `/Users/reus/Desktop/Sources/semicolon/projects/land`

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

### KB (Knowledge Base) CLI
- 터널: `bash scripts/kb-tunnel.sh start` (15432 → 10.0.0.91:5432)
- CLI: `cd /Users/reus/Desktop/Sources/semicolon/projects/semo && NODE_PATH=./node_modules node semo-system/bot-workspaces/semiclaw/scripts/kb-cli.js <cmd> [args]`
- 검색: `search "질문" [limit]` | 조회: `get <domain> <key>` | 목록: `list [domain]`
- 봇별: `bot-search/bot-get/bot-list/bot-upsert <bot_id> ...`
- 상세: `scripts/KB-USAGE.md`
- 임베딩: Voyage-3 (1024dim), 자동 생성
- DB: appdb, semo 스키마, pgvector

### Google Calendar
- 연동 완료 (2026-02-13)
- 토큰: `scripts/gcal-tokens.json`
- 기본 캘린더: 세미콜론 (팀 캘린더)
- Calendar ID: `2b3dabe6b67a16c869653de312ba2952d98901ad036cd2987e9959252bb6cd65@group.calendar.google.com`
- scope: calendar (읽기+쓰기)
- access_token 갱신: `curl -s -X POST https://oauth2.googleapis.com/token -d "client_id=..." -d "client_secret=..." -d "refresh_token=..." -d "grant_type=refresh_token"`
