#!/usr/bin/env bash
set -euo pipefail

# openclaw-runtime-diagnosis.sh
# SEMO/오픈클로우 런타임 + timeout 진단 스크립트
# - bot별 launchctl/ps/lsof 스냅샷
# - dispatch timeout matrix(2000/120000/180000) 수치화
# - dispatch 출력에서 endReason/host_exit/duration 추출
# - gateway.err 에서 kill/재시작 시그널 감지
# - 결과를 CSV + JSON summary로 영속 저장

# usage: scripts/openclaw-runtime-diagnosis.sh [query] [bot1 bot2 ...]

if [ "$#" -ge 1 ]; then
  QUERY="$1"
  shift
else
  QUERY="KB-FIRST 규칙 준수 점검 요청"
fi

# default bots
if [ "$#" -ge 1 ]; then
  BOTS=("$@")
else
  BOTS=(semiclaw designclaw growthclaw infraclaw planclaw reviewclaw workclaw)
fi

TIMELINE_SAMPLES=5
TIMELINE_INTERVAL_SEC=3
TIMEOUTS=(2000 120000 180000)
SEMOCFG="$HOME/.claude/semo/.env"
OUT_DIR="$HOME/.semo/logs"
mkdir -p "$OUT_DIR"
RUN_TS="$(date '+%Y%m%d_%H%M%S')"
CSV_OUT="$OUT_DIR/openclaw-runtime-diagnosis-${RUN_TS}.csv"
JSON_OUT="$OUT_DIR/openclaw-runtime-diagnosis-${RUN_TS}.summary.json"

# query may contain single quotes; use double quote safe path through $QUERY

_ts(){
  date '+%Y-%m-%dT%H:%M:%S%z'
}

_gateway_wrapper_port(){
  local bot="$1"
  local path="$HOME/.openclaw-${bot}/gateway-wrapper.sh"
  if [ -f "$path" ]; then
    grep -Eo "gateway --port[[:space:]]+[0-9]+" "$path" | awk '{print $3}' | tail -1 || true
  fi
}

_snapshot_launchctl(){
  local bot="$1"
  launchctl list | grep -E "ai\.openclaw\.${bot}|com\.semicolon\.semo-openclaw-${bot}|com\.semicolon\.semo-openclaw" || true
}

_snapshot_ports(){
  local bot="$1"
  local port="$2"
  if [ -n "$port" ]; then
    lsof -iTCP -sTCP:LISTEN -nP | grep -F -- "--port $port" || true
  else
    lsof -iTCP -sTCP:LISTEN -nP | grep -E "openclaw|gateway" || true
  fi
}

_snapshot_gateway_pids(){
  local port="$1"
  if [ -n "$port" ]; then
    lsof -iTCP -sTCP:LISTEN -nP | grep -F -- "openclaw.*--port $port" | awk '{print $2}' | tr '\n' '; ' | sed 's/; $//' || true
  else
    pgrep -f 'openclaw/dist/index.js gateway --port' || true
  fi
}

_json_escape(){
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\x0d//g'
}

_emit_timeline_sample(){
  local bot="$1"
  local port="$2"
  local sample_id="$3"
  local stage="$4"
  local out_file="$5"
  local ts
  local launchctl_snapshot
  local wrapper_pids
  local gateway_pids
  local ports

  ts="$(_ts)"
  launchctl_snapshot="$(_snapshot_launchctl "$bot" | tr '\n' '; ')"
  wrapper_pids="$(pgrep -f "$HOME/.openclaw-${bot}/gateway-wrapper.sh" || true)"
  gateway_pids="$(_snapshot_gateway_pids "$port")"
  ports="$(_snapshot_ports "$bot" "$port" | tr '\n' '; ')"

  printf '%s\n' "{\"sample\":${sample_id},\"stage\":\"$stage\",\"ts\":\"$ts\",\"bot\":\"$bot\",\"timeout_ms\":${timeout_ms:-0},\"launchctl\":\"$( _json_escape "$launchctl_snapshot" )\",\"wrapper_pids\":\"$( _json_escape "$wrapper_pids" )\",\"gateway_pids\":\"$( _json_escape "$gateway_pids" )\",\"ports\":\"$( _json_escape "$ports" )\"}" >> "$out_file"
}

_parse_dispatch_output(){
  local text="$1"
  local end_reason host_exit duration_ms
  end_reason=$(printf '%s' "$text" | grep -oE "endReason=[A-Za-z0-9_]+" | head -1 | cut -d= -f2 || true)
  host_exit=$(printf '%s' "$text" | grep -oE "exit_code:\s*[0-9]+" | head -1 | awk '{print $2}' || true)
  duration_ms=$(printf '%s' "$text" | grep -oE "duration_ms\s*:\s*[0-9]+" | head -1 | awk -F: '{print $2}' | tr -d ' ' || true)
  printf 'end_reason=%s\nhost_exit=%s\nduration_ms=%s\n' "${end_reason:-}" "${host_exit:-}" "${duration_ms:-}"
}

_gateway_tail_marker(){
  local bot="$1"
  local file="$HOME/.openclaw-${bot}/logs/gateway.err.log"
  if [ -f "$file" ]; then
    tail -n 40 "$file"
  fi
}

_count_kill9(){
  local bot="$1"
  local file="$HOME/.openclaw-${bot}/logs/gateway.err.log"
  if [ -f "$file" ]; then
    grep -c "Killed: 9" "$file" || true
  else
    echo 0
  fi
}

_dispatch_one(){
  local bot="$1"
  local timeout_ms="$2"
  local query="$3"
  local t0 t1 wall_ms dispatch_ms dispatch_out_file dispatch_out rc end_reason host_exit duration_ms
  local pre_launchctl post_launchctl
  local pre_wrapper_pids post_wrapper_pids pre_gateway_pids post_gateway_pids pre_ports post_ports
  local port status
  local port_num
  local timeline_file
  local dispatch_pid timeline_count killed9_note
  local diagnosis policy timeline_file_count

  port_num="$(_gateway_wrapper_port "$bot")"

  pre_launchctl="$(_snapshot_launchctl "$bot" | tr '\n' '; ')"
  pre_wrapper_pids="$(pgrep -f "$HOME/.openclaw-${bot}/gateway-wrapper.sh" || true)"
  pre_gateway_pids="$(_snapshot_gateway_pids "$port_num")"
  pre_ports="$(_snapshot_ports "$bot" "$port_num" | tr '\n' '; ')"

  timeline_file="$OUT_DIR/openclaw-runtime-diagnosis-${RUN_TS}.${bot}.${timeout_ms}ms.timeline.jsonl"
  : > "$timeline_file"
  timeline_count=0
  _emit_timeline_sample "$bot" "$port_num" "$timeline_count" "pre" "$timeline_file"

  t0=$(($(date +%s) * 1000))
  dispatch_out_file="$(mktemp)"
  (
    set +u
    source "$SEMOCFG"
    set -u
    semo runtime dispatch --adapter openclaw --bot-id "$bot" --timeout "$timeout_ms" "$query" 2>&1
  ) > "$dispatch_out_file" 2>&1 &
  dispatch_pid=$!

  while kill -0 "$dispatch_pid" 2>/dev/null; do
    if [ "$timeline_count" -lt "$TIMELINE_SAMPLES" ]; then
      _emit_timeline_sample "$bot" "$port_num" "$((timeline_count+1))" "during" "$timeline_file"
    fi
    timeline_count=$((timeline_count + 1))
    sleep "$TIMELINE_INTERVAL_SEC"
  done

  wait "$dispatch_pid"
  rc=$?
  dispatch_out="$(cat "$dispatch_out_file")"
  rm -f "$dispatch_out_file"
  t1=$(($(date +%s) * 1000))
  wall_ms=$((t1 - t0))

  _emit_timeline_sample "$bot" "$port_num" "$((timeline_count+1))" "post" "$timeline_file"
  timeline_file_count=$(wc -l < "$timeline_file")

  post_launchctl="$(_snapshot_launchctl "$bot" | tr '\n' '; ')"
  post_wrapper_pids="$(pgrep -f "$HOME/.openclaw-${bot}/gateway-wrapper.sh" || true)"
  post_gateway_pids="$(_snapshot_gateway_pids "$port_num")"
  post_ports="$(_snapshot_ports "$bot" "$port_num" | tr '\n' '; ')"

  dispatch_ms=$(printf '%s\n' "$dispatch_out" | wc -l | awk '{print $1}')
  eval "$(_parse_dispatch_output "$dispatch_out")"

  killed9_note="$(_count_kill9 "$bot")"

  # status 판단 (policy)
  if [ "$end_reason" = "completed" ]; then
    if [ "$timeout_ms" = "180000" ]; then
      diagnosis="completed"
      policy="processing_delay_within_budget"
    elif [ "$timeout_ms" = "120000" ]; then
      diagnosis="completed"
      policy="stable_or_fast"
    else
      diagnosis="completed"
      policy="stable"
    fi
  elif [ "$end_reason" = "timeout" ]; then
    if [ "$timeout_ms" = "180000" ]; then
      diagnosis="timeout"
      policy="timeout_within_budget"
    elif [ -z "$post_launchctl" ] || [ -z "$post_wrapper_pids" ] || [ -z "$post_gateway_pids" ]; then
      diagnosis="gateway_unhealthy_or_not_started"
      policy="unhealthy"
    else
      diagnosis="request_processing_delay"
      policy="slow_or_contentious"
    fi
  elif [ -n "$end_reason" ]; then
    diagnosis="other_end_reason_${end_reason}"
    policy="other_end_reason"
  else
    if [ "$rc" -ne 0 ]; then
      diagnosis="dispatch_exit_error"
      policy="command_error"
    else
      diagnosis="completed_partial_signal_missing"
      policy="partial_signal"
    fi
  fi

  if [ "$killed9_note" -gt 0 ]; then
    diagnosis="${diagnosis}#gateway_kill9_seen"
    policy="${policy}#gateway_kill9_seen"
  fi

  local out_line
  out_line="${RUN_TS},${bot},${timeout_ms},${wall_ms},${duration_ms:-},${end_reason:-},${rc},${host_exit:-},${diagnosis},${policy},${killed9_note},${timeline_file_count},${pre_launchctl},${post_launchctl},${pre_wrapper_pids},${post_wrapper_pids},${pre_gateway_pids},${post_gateway_pids},${pre_ports},${post_ports}"

  printf '%s\n' "$out_line" >> "$CSV_OUT"

  printf '%s | %s | timeout=%s | wall=%s | end=%s | policy=%s | dispatch_exit=%s | host_exit=%s | diag=%s\n' "$(printf '%s' "$bot")" "$(_ts)" "$timeout_ms" "$wall_ms" "${end_reason:-}" "$policy" "$rc" "${host_exit:-}" "$diagnosis"

  local meta_file="$OUT_DIR/openclaw-runtime-diagnosis-${RUN_TS}.${bot}.${timeout_ms}ms.json"
  cat > "$meta_file" <<JSON
{
  "bot": "${bot}",
  "timeout_ms": ${timeout_ms},
  "wall_ms": ${wall_ms},
  "host_ms": ${duration_ms:-0},
  "end_reason": "${end_reason:-}",
  "dispatch_exit": ${rc},
  "host_exit": "${host_exit:-}",
  "diagnosis": "${diagnosis}",
  "policy": "${policy}",
  "killed9_count": ${killed9_note:-0},
  "timeline_file": "${timeline_file}",
  "timeline_samples": ${timeline_file_count},
  "port": "${port_num:-}",
  "pre_launchctl": "${pre_launchctl}",
  "post_launchctl": "${post_launchctl}",
  "pre_gateway_pids": "${pre_gateway_pids}",
  "post_gateway_pids": "${post_gateway_pids}",
  "gateway_err_tail": "$(printf '%s' "$(_gateway_tail_marker "$bot")" | tr '"' "'" | tr '\n' '\\n')",
  "dispatch_output_tail": "$(printf '%s' "$dispatch_out" | tr '"' "'" | tr '\n' '\\n')"
}
JSON
}

if [ ! -f "$SEMOCFG" ]; then
  echo "[ERR] SEMO env missing: $SEMOCFG" >&2
  exit 1
fi

printf 'started_at,bot_id,timeout_ms,wall_ms,host_ms,end_reason,dispatch_exit,host_exit,diagnosis,policy,killed9_count,timeline_samples,pre_launchctl,post_launchctl,pre_wrapper_pids,post_wrapper_pids,pre_gateway_pids,post_gateway_pids,pre_ports,post_ports\n' > "$CSV_OUT"

TOTAL=0
FAIL=0

for bot in "${BOTS[@]}"; do
  if [ ! -d "$HOME/.openclaw-${bot}" ]; then
    echo "[SKIP] missing profile: $bot"
    continue
  fi

  for t in "${TIMEOUTS[@]}"; do
    set +e
    _dispatch_one "$bot" "$t" "$QUERY"
    rc=$?
    set -e
    TOTAL=$((TOTAL + 1))
    if [ "$rc" -ne 0 ]; then
      FAIL=$((FAIL + 1))
    fi
  done

done

cat > "$JSON_OUT" <<JSON
{
  "started_at": "$(date '+%Y-%m-%dT%H:%M:%S%z')",
  "query": "${QUERY}",
  "bots": [
$(for i in "${!BOTS[@]}"; do
  idx=$i
  if [ "$idx" -lt "$((${#BOTS[@]}-1))" ]; then
    printf '    "%s",\n' "${BOTS[$idx]}"
  else
    printf '    "%s"\n' "${BOTS[$idx]}"
  fi
 done)
  ],
  "timeouts": [2000,120000,180000],
  "total_runs": ${TOTAL},
  "failed_runs": ${FAIL},
  "csv": "${CSV_OUT}",
  "seed_env": "${SEMOCFG}"
}
JSON

printf 'RUN_DONE total=%s fail=%s csv=%s summary=%s\n' "$TOTAL" "$FAIL" "$CSV_OUT" "$JSON_OUT"
