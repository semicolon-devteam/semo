# Bot Workspaces

OpenClaw 봇들의 workspace를 GitHub 형상관리하기 위한 디렉토리.

## 구조

각 봇의 설정파일, 메모리, 스크립트를 관리합니다:

| 봇 | OpenClaw 홈 | symlink 원본 |
|---|---|---|
| semiclaw | `~/.openclaw` | `~/.openclaw/workspace` → 여기 `semiclaw/` |
| workclaw | `~/.openclaw-workclaw` | workspace → `workclaw/` |
| planclaw | `~/.openclaw-planclaw` | workspace → `planclaw/` |
| reviewclaw | `~/.openclaw-reviewclaw` | workspace → `reviewclaw/` |
| designclaw | `~/.openclaw-designclaw` | workspace → `designclaw/` |
| growthclaw | `~/.openclaw-growthclaw` | workspace → `growthclaw/` |
| infraclaw | `~/.openclaw-infraclaw` | workspace → `infraclaw/` |

## 관리 대상 파일

- `SOUL.md`, `USER.md`, `IDENTITY.md`, `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`
- `memory/` — daily logs, decisions, team notes 등
- `scripts/` — 유틸리티 스크립트 (있는 경우)

## 동기화

각 봇의 `~/.openclaw-{bot}/workspace`는 이 디렉토리의 해당 봇 폴더로 symlink됩니다.
봇이 workspace에 파일을 쓰면 자동으로 이 레포에 반영됩니다.

### 수동 동기화
```bash
cd semo-system/bot-workspaces
./sync.sh
```

### 자동 동기화 (cron)
```bash
# 매 30분마다 자동 commit & push
*/30 * * * * cd /path/to/semo && semo-system/bot-workspaces/sync.sh >> /tmp/bot-workspace-sync.log 2>&1
```

## 주의사항

- `.env`, 토큰 파일 등 시크릿은 `.gitignore`로 제외됨
- 대용량 바이너리 (이미지, 동영상)도 제외됨
- 봇의 작업 산출물 (프로젝트 분석 결과 등)은 여기서 관리하지 않음
