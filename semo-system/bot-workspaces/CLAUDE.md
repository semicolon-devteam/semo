# OpenClaw Bot Workspaces — Claude Configuration

## SoT (Single Source of Truth) 경로

이 디렉토리(`semo-system/bot-workspaces/`)가 OpenClaw 봇들의 **파일 기준 SoT**다.

### 워크스페이스 연결 방식

각 봇의 `openclaw.json`에서 `agents.defaults.workspace`가 이 디렉토리의 절대 경로를 직접 참조한다.
**심링크 없음** — `openclaw.json` 설정으로 직접 연결.

| 봇 | OpenClaw 홈 | workspace 경로 |
|---|---|---|
| semiclaw | `~/.openclaw` + `~/.openclaw-semiclaw` | `semo-system/bot-workspaces/semiclaw` |
| workclaw | `~/.openclaw-workclaw` | `semo-system/bot-workspaces/workclaw` |
| (나머지 동일 패턴) | `~/.openclaw-{봇명}` | `semo-system/bot-workspaces/{봇명}` |

**따라서:**
- 이 디렉토리에서 파일을 수정하면 봇 런타임에 즉시 반영됨
- `~/.openclaw/` 경로를 직접 수정할 필요 없음
- 이 디렉토리가 git 형상관리 대상

### 데이터 흐름

```
이 디렉토리 (SoT, git repo)
  ↑ openclaw.json workspace 경로 설정
~/.openclaw[-{봇}]/ (봇 런타임 — 직접 참조)
  ↓ sync-agent (1분 주기)
Core DB (bot_workspace_files 테이블)
  ↓ Dashboard API
semo-dashboard (DB에서 읽기)
```

### 스킬 수정 시 주의사항

- SKILL.md 수정 → 이 디렉토리에서 직접 수정
- references/ 파일 → 이 디렉토리에서 직접 수정
- scripts/ 파일 → 이 디렉토리에서 직접 수정
- DB 반영 필요 시 → `semo bots sync && semo context sync`
- `~/.claude/skills/`에는 SKILL.md만 배포됨 (references, scripts 제외)
  → 봇은 workspace에서 직접 읽으므로 문제 없음
  → 로컬 Claude Code 세션은 글로벌 캐시의 SKILL.md만 참조

### Memory 파일 수정 시 즉시 DB 동기화

봇이 `memory/` 하위 파일(예: `projects/ps.md`, `projects.md` 등)을 수정한 경우,
**수정 직후 반드시** 해당 도메인을 Core DB에 push해야 한다.

```bash
semo context push --domain <도메인> --out-dir <memDir>
```

| 수정 파일 | 도메인 | 예시 |
|-----------|--------|------|
| `projects.md` 또는 `projects/*.md` | `project` | `semo context push --domain project` |
| `decisions.md` | `decision` | `semo context push --domain decision` |
| `infra.md` | `infra` | `semo context push --domain infra` |
| `process.md` | `process` | `semo context push --domain process` |
| `team.md` | `team` | `semo context push --domain team` |

**왜?** 세션 종료(stop) 훅에서도 push가 실행되지만, 세션 중간에 수정한 내용은
세션이 끝날 때까지 Core DB에 반영되지 않는다. 다른 봇이나 로컬 세션이
`context sync`로 최신 데이터를 받으려면 **수정 즉시 push**해야 한다.

**임베딩도 함께 갱신된다.** `context push`는 upsert 후 자동으로 벡터 임베딩을 재생성한다.

### OpenClaw 공식 메시지 전송

봇이 Slack 메시지를 보내는 공식 도구:
```bash
message --action send --target <CHANNEL_ID> --message "<텍스트>"
```
이 도구는 OpenClaw 게이트웨이 내장이며, 봇 세션 내에서만 사용 가능.
로컬 Claude Code 세션에서는 사용 불가 → 게이트웨이 HTTP API 또는 수동 처리.

### 롤백 절차

문제 발생 시 심링크를 재생성하면 즉시 복구 가능:
```bash
for bot in workclaw reviewclaw planclaw designclaw infraclaw growthclaw; do
  ln -s /path/to/semo-system/bot-workspaces/$bot ~/.openclaw-$bot/workspace
done
ln -s /path/to/semo-system/bot-workspaces/semiclaw ~/.openclaw/workspace
```
handler.ts에 fallback이 있어 `openclaw.json` 읽기 실패 시 기존 경로로 자동 복구됨.
