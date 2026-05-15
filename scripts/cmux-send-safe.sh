#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  cmux-send-safe.sh --workspace workspace:N --surface surface:N (--message TEXT | --stdin)

Options:
  --workspace REF          Target cmux workspace ref.
  --surface REF            Target cmux surface ref.
  --message TEXT           Message to send.
  --stdin                  Read message from stdin.
  --require-idle           Refuse to send unless target screen looks idle (default).
  --force                  Send even if idle check fails.
  --no-enter-fallback      Do not send an explicit Enter key after newline.

Exit codes:
  0  sent
  10 workspace/surface not found
  11 target is busy or idle state is unclear
  12 cmux send failed
  13 cmux enter fallback failed
USAGE
}

workspace=""
surface=""
message=""
read_stdin=0
require_idle=1
enter_fallback=1

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
    --message)
      message="${2:-}"
      shift 2
      ;;
    --stdin)
      read_stdin=1
      shift
      ;;
    --require-idle)
      require_idle=1
      shift
      ;;
    --force)
      require_idle=0
      shift
      ;;
    --no-enter-fallback)
      enter_fallback=0
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

if [[ -z "$workspace" || -z "$surface" ]]; then
  echo "workspace and surface are required" >&2
  usage >&2
  exit 2
fi

if [[ "$read_stdin" -eq 1 ]]; then
  message="$(cat)"
fi

if [[ -z "$message" ]]; then
  echo "message is required" >&2
  usage >&2
  exit 2
fi

if ! cmux tree --workspace "$workspace" 2>/dev/null | grep -Fq "$surface"; then
  echo "target surface not found: $workspace $surface" >&2
  exit 10
fi

is_codex=0

if [[ "$require_idle" -eq 1 ]]; then
  screen="$(cmux read-screen --workspace "$workspace" --surface "$surface" --lines 80 2>/dev/null || true)"
  # Strip ANSI before pattern matching
  clean="$(printf '%s\n' "$screen" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g; s/\x1b[()][0-9A-Za-z]//g; s/\r//g')"
  if printf '%s\n' "$clean" | grep -Eiq 'Coalescing|Thinking|Working|Running|Processing|Analyzing|Generating|esc to interrupt|tool call|Waiting for|읽는 중|실행 중|생각 중|도구 사용 중|분석 중'; then
    echo "target surface appears busy: $workspace $surface" >&2
    exit 11
  fi
  if ! printf '%s\n' "$clean" | grep -Eq '(^|[[:space:]])(❯|›|✦|>)($|[[:space:]])|bypass permissions on|gpt-[0-9]|Claude Code|Codex|\$[[:space:]]'; then
    echo "target surface idle state is unclear: $workspace $surface" >&2
    exit 11
  fi
  # Detect Codex CLI pane (gpt-* indicator in screen footer)
  if printf '%s\n' "$clean" | grep -Eq 'gpt-[0-9]'; then
    is_codex=1
  fi
fi

# Codex CLI enters multiline input mode when message contains newlines.
# Flatten internal newlines to literal \n so the message is sent as a single line,
# allowing the subsequent Enter to submit rather than append.
send_message="$message"
if [[ "$is_codex" -eq 1 && "$message" == *$'\n'* ]]; then
  send_message="${message//$'\n'/\\n}"
fi

if ! cmux send --workspace "$workspace" --surface "$surface" "$send_message"; then
  echo "cmux send message failed: $workspace $surface" >&2
  exit 12
fi

if ! cmux send --workspace "$workspace" --surface "$surface" $'\n'; then
  echo "cmux send newline failed: $workspace $surface" >&2
  exit 12
fi

if [[ "$enter_fallback" -eq 1 ]]; then
  if ! cmux send-key --workspace "$workspace" --surface "$surface" Enter; then
    echo "cmux send-key Enter failed: $workspace $surface" >&2
    exit 13
  fi
fi

