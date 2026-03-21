# Bot Workspaces

OpenClaw 봇들의 workspace를 GitHub 형상관리하기 위한 디렉토리.

## 구조

각 봇의 `openclaw.json` → `agents.defaults.workspace`가 이 디렉토리를 직접 참조합니다.
심링크 없이 설정 기반으로 연결됩니다.

| 봇 | OpenClaw 홈 | workspace 경로 (이 디렉토리) |
|---|---|---|
| semiclaw | `~/.openclaw` + `~/.openclaw-semiclaw` | `semiclaw/` |
| workclaw | `~/.openclaw-workclaw` | `workclaw/` |
| planclaw | `~/.openclaw-planclaw` | `planclaw/` |
| reviewclaw | `~/.openclaw-reviewclaw` | `reviewclaw/` |
| designclaw | `~/.openclaw-designclaw` | `designclaw/` |
| growthclaw | `~/.openclaw-growthclaw` | `growthclaw/` |
| infraclaw | `~/.openclaw-infraclaw` | `infraclaw/` |

## 관리 대상 파일

- `SOUL.md`, `USER.md`, `IDENTITY.md`, `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`
- `memory/` — daily logs, decisions, team notes 등
- `scripts/` — 유틸리티 스크립트 (있는 경우)

## 스킬 (`skills/`)

각 봇은 `skills/` 디렉토리에 봇 전용 스킬을 가질 수 있습니다:

```
bot-workspaces/workclaw/skills/
  └── some-skill/
      └── SKILL.md
```

- `semo bots sync` 또는 `semo context sync` 실행 시 자동으로 DB(`skill_definitions`)에 동기화됩니다.
- `target_agents`에 `'{봇명}'`이 설정되어 해당 봇만 해당 스킬을 사용합니다.

## 동기화

봇의 `openclaw.json`에서 이 디렉토리를 직접 참조하므로, 봇이 workspace에 파일을 쓰면 자동으로 이 레포에 반영됩니다.

sync-agent가 1분 주기로 이 디렉토리의 파일을 Core DB(`semo.bot_workspace_files`)에 업로드합니다.
Dashboard는 DB에서 읽으므로 로컬 FS 접근 없이도 봇 파일을 조회할 수 있습니다.

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
