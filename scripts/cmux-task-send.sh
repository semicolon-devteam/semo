#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
send_safe="$script_dir/cmux-send-safe.sh"
wait_script="$script_dir/cmux-task-wait.sh"

usage() {
  cat <<'USAGE'
Usage:
  cmux-task-send.sh --to-workspace workspace:N --to-surface surface:N --task TEXT

Options:
  --to-workspace REF        Target cmux workspace ref.
  --to-surface REF          Target cmux surface ref.
  --reply-workspace REF     Reply cmux workspace ref. Defaults to --from-workspace.
  --reply-surface REF       Reply cmux surface ref. Defaults to --from-surface.
  --from-workspace REF      Sender workspace ref. Defaults to CMUX_WORKSPACE_ID or current identify.
  --from-surface REF        Sender surface ref. Defaults to CMUX_SURFACE_ID or current identify.
  --mode MODE               blocking or parallel. Default: blocking.
  --task TEXT               Task body.
  --stdin                   Read task body from stdin.
  --slug SLUG               Id slug. Default: task.
  --id ID                   Explicit task id.
  --wait                    Wait for [cmux-reply] with matching id when mode=blocking.
  --timeout SECONDS         Wait timeout. Default: 300.
  --interval SECONDS        Wait interval. Default: 5.
  --force                   Send even if target idle check fails.

Exit codes:
  0  sent or reply found
  2  usage error
  30 missing sender/reply surface information
USAGE
}

to_workspace=""
to_surface=""
from_workspace="${CMUX_WORKSPACE_ID:-}"
from_surface="${CMUX_SURFACE_ID:-}"
reply_workspace=""
reply_surface=""
mode="blocking"
task=""
read_stdin=0
slug="task"
task_id=""
wait_for_reply=0
timeout=300
interval=5
force=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to-workspace)
      to_workspace="${2:-}"
      shift 2
      ;;
    --to-surface)
      to_surface="${2:-}"
      shift 2
      ;;
    --reply-workspace)
      reply_workspace="${2:-}"
      shift 2
      ;;
    --reply-surface)
      reply_surface="${2:-}"
      shift 2
      ;;
    --from-workspace)
      from_workspace="${2:-}"
      shift 2
      ;;
    --from-surface)
      from_surface="${2:-}"
      shift 2
      ;;
    --mode)
      mode="${2:-}"
      shift 2
      ;;
    --task)
      task="${2:-}"
      shift 2
      ;;
    --stdin)
      read_stdin=1
      shift
      ;;
    --slug)
      slug="${2:-}"
      shift 2
      ;;
    --id)
      task_id="${2:-}"
      shift 2
      ;;
    --wait)
      wait_for_reply=1
      shift
      ;;
    --timeout)
      timeout="${2:-}"
      shift 2
      ;;
    --interval)
      interval="${2:-}"
      shift 2
      ;;
    --force)
      force=1
      shift
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

if [[ "$read_stdin" -eq 1 ]]; then
  task="$(cat)"
fi

if [[ -z "$to_workspace" || -z "$to_surface" || -z "$task" ]]; then
  echo "to-workspace, to-surface, and task are required" >&2
  usage >&2
  exit 2
fi

if [[ "$mode" != "blocking" && "$mode" != "parallel" ]]; then
  echo "mode must be blocking or parallel" >&2
  exit 2
fi

if [[ -z "$from_workspace" || -z "$from_surface" ]]; then
  if identify="$(cmux identify 2>/dev/null || true)"; then
    from_workspace="${from_workspace:-$(printf '%s\n' "$identify" | grep -o 'workspace:[0-9][0-9]*' | head -1 || true)}"
    from_surface="${from_surface:-$(printf '%s\n' "$identify" | grep -o 'surface:[0-9][0-9]*' | head -1 || true)}"
  fi
fi

reply_workspace="${reply_workspace:-$from_workspace}"
reply_surface="${reply_surface:-$from_surface}"

if [[ -z "$from_workspace" || -z "$from_surface" || -z "$reply_workspace" || -z "$reply_surface" ]]; then
  echo "missing sender or reply surface information" >&2
  exit 30
fi

safe_slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9_-' '-' | sed 's/^-//; s/-$//')"
safe_slug="${safe_slug:-task}"
if [[ -z "$task_id" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    rand="$(openssl rand -hex 3)"
  else
    rand="${RANDOM}${RANDOM}"
  fi
  task_id="cmux-${safe_slug}-$(date +%s)-${rand}"
fi

payload="$(cat <<PAYLOAD
[cmux-task]
id: $task_id
from: $from_workspace $from_surface
reply_to: $reply_workspace $reply_surface
mode: $mode
task:
$task
PAYLOAD
)"

send_args=(--workspace "$to_workspace" --surface "$to_surface" --message "$payload")
if [[ "$force" -eq 1 ]]; then
  send_args+=(--force)
fi
"$send_safe" "${send_args[@]}"

printf 'cmux-task id: %s\n' "$task_id"

if [[ "$wait_for_reply" -eq 1 && "$mode" == "blocking" ]]; then
  "$wait_script" --workspace "$reply_workspace" --surface "$reply_surface" --id "$task_id" --timeout "$timeout" --interval "$interval"
fi

