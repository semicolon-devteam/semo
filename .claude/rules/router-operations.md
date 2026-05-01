# Router 운영 패턴 (cmux-hosted service)

> slack-router / discord-router 는 **cmux pane 안에서 동작하는 서비스** 다.
> daemon(launchd/nohup detach) 으로 띄우면 cmux IPC 호출(`cmux send`) 이 거부되어 봇 nudge 가 끊긴다.
> 결정 근거: `semo kb get semo decision/router-cmux-nudge-persistence` (2026-05-01, Codex 협의).

## NON-NEGOTIABLE 시작 패턴

router 는 살아있는 cmux pane 의 자손으로만 띄운다. 다음 중 하나:

```bash
# Option B (현재 표준) — 프로젝트 루트 cmux pane 안에서 백그라운드
cd /Users/reus/Desktop/Sources/semicolon/projects/semo
set -a && source ~/.claude/semo/.env && set +a
npx tsx packages/slack-router/src/index.ts > ~/.semo/logs/slack-router.log 2>&1 &
npx tsx packages/discord-router/src/bin.ts  > ~/.semo/logs/discord-router.log 2>&1 &
```

**금지**: `nohup … & disown`, `launchctl load …`, `systemd-run …`. cmux ancestry 가 끊기면 nudge 가 "Failed to write to socket" 으로 침묵 실패한다.

## Health Check

```bash
# 1) 프로세스 살아있고 cmux ancestry 보존?
for pid in $(pgrep -f "slack-router/src/index.ts|discord-router/src/bin.ts"); do
  ps -p $pid -o pid,ppid,tty,etime,command | tail -1
done
# 기대값: TTY=ttysNNN (NOT '??'), PPID=cmux pane shell (NOT 1/launchd)

# 2) 최근 nudge 성공 비율
tail -200 ~/.semo/logs/slack-router.log | grep -E "\[nudge\]" | tail -10
# 기대값: ': OK' 가 다수, 'cmux delivery failed (non-fatal)' 산발 가능
```

## 침묵 실패 시그널

| 증상                                                             | 진단                                    | 조치                                                    |
| ---------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `Failed to write to socket` 반복                                 | router 가 daemon 화 (TTY=??)            | 프로세스 kill 후 cmux pane 안에서 재기동                |
| `Access denied — only processes started inside cmux can connect` | `CMUX_PANEL_ID` 가 가리키는 패널이 닫힘 | 동일 — 살아있는 패널에서 재기동                         |
| nudge 다 OK 인데 봇이 응답 안 함                                 | 봇 Claude 세션 종료/멈춤                | `cmux read-screen` 으로 봇 패널 확인, 필요 시 봇 재기동 |

## Resilience Layer (2026-05-01 추가)

cmux nudge 실패해도 메시지 유실은 안 된다. SoT 는 `~/.semo/mailbox/{bot}/inbox.jsonl`. 다음 3계층이 자동 복구:

1. **MCP fs.watch** (agent-mailbox watchInbox) — inbox 파일 변경 시 봇 세션에 system notification 푸시
2. **MCP 3초 폴링** — fallback for fs.watch failure
3. **Stop hook `inbox-drain-prompt.sh`** — 봇 세션 idle 진입 시점에 미처리 inbox 있으면 `check_inbox` 강제 prompt

→ `inbox-writer.ts` 의 `nudge` 는 best-effort. 실패는 `console.warn` 만 찍고 메시지 처리 책임은 위 3계층이 짊어진다.

## 재발 시 자동 복구 절차

```bash
# 1) daemon 화된 router 식별
pgrep -fl "slack-router|discord-router" | while read pid rest; do
  tty=$(ps -o tty= -p $pid | tr -d ' ')
  ppid=$(ps -o ppid= -p $pid | tr -d ' ')
  if [[ "$tty" == "??" || "$ppid" == "1" ]]; then
    echo "DAEMON DETECTED: $pid ($rest)"
  fi
done

# 2) 로그 회전 + kill
mv ~/.semo/logs/slack-router.log ~/.semo/logs/slack-router.log.$(date +%m%d-%H%M%S)
mv ~/.semo/logs/discord-router.log ~/.semo/logs/discord-router.log.$(date +%m%d-%H%M%S)
kill <DAEMON_PIDS>

# 3) cmux pane 안에서 재기동 — 위 NON-NEGOTIABLE 시작 패턴 그대로
```

## 향후 (장기 — 별건)

- [ ] `inbox-writer.ts` nudge 자체 폐지 → MCP fs.watch + Stop hook 로 100% 위임
- [ ] router 시작 시 자기 자신의 cmux ancestry 검증 후 daemon 모드면 즉시 종료 + 에러 로그
- [ ] cmux pane 닫힘 자동 감지 → 다른 살아있는 pane 으로 자동 fail-over (어렵지만 깨끗)
