#!/usr/bin/env bash
# openclaw-socket-watchdog.sh — OpenClaw 7봇 Slack socket health 감시 + 자동 복구
#
# 배경: Slack socket-mode 는 ~5시간마다 disconnect 를 강제하고 client 가
# auto-reconnect 해야 한다. OpenClaw SDK 의 reconnect 가 12회 attempt 후 포기하면
# 봇이 영구 dead-socket 상태로 남는 패턴이 반복 관찰됨
# (KB: semo incident/openclaw-7-bots-socket-disconnect-2026-05-07).
#
# v1 (2026-05-08): lsof port 443 ESTABLISHED 카운트로 판정 — false positive 발생.
# OpenClaw 프로세스가 bonjour/HTTP 등 다른 443 연결을 갖고 있으면 Slack WSS 가
# 끊겨도 healthy 로 오판 (semi incident 2026-05-10 09:30 사례).
#
# v2 (2026-05-10): **gateway.log 의 socket 이벤트 시퀀스** 를 1차 신호로 사용 +
# lsof 는 보조. 검출 우선순위:
#   1) 마지막 socket event 가 `failed to start` (retry chain) 이고 STALE → unhealthy
#   2) 마지막 event 가 `disconnected` 이고 새 `connected` 없이 STALE 경과 → unhealthy
#   3) 마지막 event 가 `connected` 이지만 lsof port 443 = 0 → unhealthy (보강)
#   4) 그 외 → healthy
#
# 의존: launchctl, lsof, awk, date (BSD/macOS)
# 로그: ~/.semo/logs/openclaw-socket-watchdog.log

set -uo pipefail

BOTS=(semiclaw planclaw reviewclaw infraclaw workclaw designclaw growthclaw)
KICKSTART_COOLDOWN_SEC=300   # 같은 봇 5분 내 중복 kickstart 차단
STARTUP_GRACE_SEC=120        # 프로세스 부팅 후 2분간은 socket 미체결 허용
SOCKET_STALE_SEC=180         # disconnect 또는 failed 가 3분 넘게 지속되면 unhealthy

LOG_DIR="$HOME/.semo/logs"
LOG_FILE="$LOG_DIR/openclaw-socket-watchdog.log"
STATE_DIR="$HOME/.semo/state/openclaw-socket-watchdog"

mkdir -p "$LOG_DIR" "$STATE_DIR"

ts() { date "+%Y-%m-%dT%H:%M:%S%z"; }
log() { printf "[%s] %s\n" "$(ts)" "$*" >> "$LOG_FILE"; }

now_epoch=$(date +%s)

gateway_node_pid() {
  local bot="$1"
  launchctl print "gui/$(id -u)/ai.openclaw.$bot" 2>/dev/null \
    | awk '/^[[:space:]]*pid =/ {print $3; exit}'
}

node_child_pid() {
  local parent_pid="$1"
  pgrep -P "$parent_pid" -f "openclaw/dist/index.js gateway" 2>/dev/null | head -1
}

slack_conn_count() {
  local pid="$1"
  lsof -nP -iTCP -sTCP:ESTABLISHED -a -p "$pid" 2>/dev/null \
    | grep -c ":443"
}

recently_started() {
  local pid="$1"
  local start_epoch
  start_epoch=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs -I{} date -j -f "%a %b %e %T %Y" "{}" "+%s" 2>/dev/null)
  if [ -z "$start_epoch" ]; then
    return 1
  fi
  local age=$((now_epoch - start_epoch))
  [ "$age" -lt "$STARTUP_GRACE_SEC" ]
}

# ISO timestamp (e.g., "2026-05-10T09:28:01.250+09:00") → epoch seconds.
iso_to_epoch() {
  local iso="$1"
  local clean
  clean=$(printf '%s' "$iso" | awk '{ sub(/\.[0-9]+/, ""); sub(/[+-][0-9:]+$/, ""); print }')
  date -j -f "%Y-%m-%dT%H:%M:%S" "$clean" "+%s" 2>/dev/null
}

# gateway.log 의 마지막 slack socket 이벤트를 분석.
# 출력: "<state>|<event_iso>|<age_seconds>"
#   state: connected | disconnected | failed | unknown
#   event_iso: 이벤트 ISO timestamp ("" 이면 unknown)
#   age_seconds: 현재 시각 - event_epoch (음수/공란이면 -1)
last_socket_event() {
  local bot="$1"
  local gw_log="$HOME/.openclaw-$bot/logs/gateway.log"
  local err_log="$HOME/.openclaw-$bot/logs/gateway.err.log"

  if [ ! -f "$gw_log" ]; then
    echo "unknown||-1"
    return
  fi

  # gateway.log + err.log 결합 후 timestamp 기준 정렬해 마지막 이벤트 추출.
  # err.log 에는 "socket mode failed to start; retry N/12" 형태가 들어감.
  local raw
  raw=$(grep -hE "\[slack\] (socket (mode connected|disconnected)|socket mode failed to start)" \
        "$gw_log" "$err_log" 2>/dev/null \
        | sort | tail -1)

  if [ -z "$raw" ]; then
    echo "unknown||-1"
    return
  fi

  local state
  if echo "$raw" | grep -q "socket mode connected"; then
    state="connected"
  elif echo "$raw" | grep -q "failed to start"; then
    state="failed"
  else
    state="disconnected"
  fi

  local iso
  iso=$(printf '%s' "$raw" | awk '{print $1}')
  local epoch
  epoch=$(iso_to_epoch "$iso")
  local age=-1
  if [ -n "$epoch" ]; then
    age=$((now_epoch - epoch))
  fi

  echo "${state}|${iso}|${age}"
}

kickstart_bot() {
  local bot="$1"
  local reason="$2"
  local state_file="$STATE_DIR/${bot}.last-kickstart"

  if [ -f "$state_file" ]; then
    local last_kick=$(cat "$state_file" 2>/dev/null || echo 0)
    local elapsed=$((now_epoch - last_kick))
    if [ "$elapsed" -lt "$KICKSTART_COOLDOWN_SEC" ]; then
      log "$bot: $reason — but cooldown ${elapsed}s/${KICKSTART_COOLDOWN_SEC}s, skip"
      return
    fi
  fi

  log "$bot: $reason — kickstarting LaunchAgent"
  if launchctl kickstart -k "gui/$(id -u)/ai.openclaw.$bot" 2>>"$LOG_FILE"; then
    echo "$now_epoch" > "$state_file"
    log "$bot: kickstart issued"
  else
    log "$bot: kickstart FAILED (exit $?)"
  fi
}

for bot in "${BOTS[@]}"; do
  wrapper_pid=$(gateway_node_pid "$bot")
  if [ -z "$wrapper_pid" ]; then
    kickstart_bot "$bot" "launchctl reports no PID"
    continue
  fi

  node_pid=$(node_child_pid "$wrapper_pid")
  if [ -z "$node_pid" ]; then
    kickstart_bot "$bot" "wrapper $wrapper_pid alive but node child missing"
    continue
  fi

  if recently_started "$node_pid"; then
    # 부팅 grace — log/lsof 둘 다 검사 보류
    continue
  fi

  # 1차 신호: gateway.log 의 socket event 시퀀스
  ev_info=$(last_socket_event "$bot")
  ev_state=$(printf '%s' "$ev_info" | cut -d'|' -f1)
  ev_iso=$(printf '%s' "$ev_info" | cut -d'|' -f2)
  ev_age=$(printf '%s' "$ev_info" | cut -d'|' -f3)

  case "$ev_state" in
    failed)
      if [ "$ev_age" -ge 0 ] && [ "$ev_age" -gt "$SOCKET_STALE_SEC" ]; then
        kickstart_bot "$bot" "last event=failed age=${ev_age}s (last=$ev_iso)"
        continue
      fi
      ;;
    disconnected)
      if [ "$ev_age" -ge 0 ] && [ "$ev_age" -gt "$SOCKET_STALE_SEC" ]; then
        kickstart_bot "$bot" "last event=disconnected (no reconnect) age=${ev_age}s (last=$ev_iso)"
        continue
      fi
      ;;
    connected)
      # 2차 신호 (보강): connected 라고 로그에 있어도 lsof 카운트 0 이면 의심.
      conns=$(slack_conn_count "$node_pid")
      if [ "$conns" -eq 0 ]; then
        kickstart_bot "$bot" "log=connected but lsof port 443 = 0 (last=$ev_iso)"
        continue
      fi
      ;;
    unknown)
      # event 자체가 없음. lsof 보조 판정.
      conns=$(slack_conn_count "$node_pid")
      if [ "$conns" -eq 0 ]; then
        kickstart_bot "$bot" "no socket event in log AND lsof port 443 = 0"
        continue
      fi
      ;;
  esac
done
