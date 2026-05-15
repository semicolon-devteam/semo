#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  cmux-task-wait.sh --workspace workspace:N --surface surface:N --id TASK_ID

Options:
  --workspace REF       Reply cmux workspace ref.
  --surface REF         Reply cmux surface ref.
  --id TASK_ID          cmux task id to wait for.
  --timeout SECONDS     Default: 300.
  --interval SECONDS    Default: 5.
  --max-attempts N      Default: 60.

Exit codes:
  0  reply found
  20 timeout
  21 reply surface not found
  22 cmux read failed
USAGE
}

workspace=""
surface=""
task_id=""
timeout=300
interval=5
max_attempts=60

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      workspace="${2:-}"
      shift 2
      ;;
    --surface)
      surface="${2:-}"
      shift 2
      ;;
    --id)
      task_id="${2:-}"
      shift 2
      ;;
    --timeout)
      timeout="${2:-}"
      shift 2
      ;;
    --interval)
      interval="${2:-}"
      shift 2
      ;;
    --max-attempts)
      max_attempts="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$workspace" || -z "$surface" || -z "$task_id" ]]; then
  echo "workspace, surface, and id are required" >&2
  usage >&2
  exit 2
fi

if ! cmux tree --workspace "$workspace" 2>/dev/null | grep -Fq "$surface"; then
  echo "reply surface not found: $workspace $surface" >&2
  exit 21
fi

deadline=$(( $(date +%s) + timeout ))
attempt=0

strip_ansi() {
  sed 's/\x1b\[[0-9;]*[A-Za-z]//g; s/\x1b[()][0-9A-Za-z]//g; s/\x0f//g; s/\x0e//g; s/\r//g'
}

extract_reply() {
  awk -v id="$task_id" '
    /\[cmux-reply\]/ {
      capture=1
      matched=0
      buf=$0 "\n"
      next
    }
    capture {
      if ($0 ~ /^\[cmux-(task|reply)\]/) {
        if (matched) {
          printf "%s", buf
          exit 0
        }
        buf=$0 "\n"
        matched=0
        next
      }
      buf=buf $0 "\n"
      if (index($0, "id: " id) > 0 || index($0, "id=" id) > 0) {
        matched=1
      }
      # Prompt terminators: shell prompt, Claude Code prompt (❯ › ✦ >), separator lines
      if (matched && ($0 ~ /^[-─=]{5,}/ || $0 ~ /[❯›✦>][[:space:]]*$/ || $0 ~ /^\$/)) {
        printf "%s", buf
        exit 0
      }
    }
    END {
      if (matched) {
        printf "%s", buf
      }
    }
  '
}

printf 'waiting for [cmux-reply] id: %s (timeout %ds)\n' "$task_id" "$timeout" >&2
printf 'recovery: rerun with --id %s if interrupted\n' "$task_id" >&2

while true; do
  now=$(date +%s)
  if [[ "$now" -ge "$deadline" || "$attempt" -ge "$max_attempts" ]]; then
    echo "timeout waiting for [cmux-reply] id: $task_id" >&2
    echo "recovery: cmux-task-wait.sh --workspace $workspace --surface $surface --id $task_id" >&2
    exit 20
  fi

  if ! screen="$(cmux read-screen --workspace "$workspace" --surface "$surface" --lines 240 2>/dev/null)"; then
    echo "cmux read-screen failed: $workspace $surface" >&2
    exit 22
  fi

  if reply="$(printf '%s\n' "$screen" | strip_ansi | extract_reply)" && [[ -n "$reply" ]]; then
    printf '%s\n' "$reply"
    exit 0
  fi

  attempt=$((attempt + 1))
  printf '  [%d/%d] %ds elapsed\r' "$attempt" "$max_attempts" "$(( now - (deadline - timeout) ))" >&2
  sleep "$interval"
done

