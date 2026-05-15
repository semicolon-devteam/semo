#!/usr/bin/env bash
set -euo pipefail

BASE_REF="HEAD"
STATUS="${SEMO_KB_WRITEBACK_STATUS:-}"

usage() {
  cat <<'EOF'
Usage: scripts/check-kb-writeback.sh [--base <ref>] [--status written|not-needed|pending]

Heuristic guard for SEMO/Codex work:
- scans git diff for durable product/process/metadata changes
- requires an explicit KB write-back status when such changes are present

Status meanings:
- written: KB/action item/commitment was updated; final response should include path/ID
- not-needed: durable write-back was considered and intentionally skipped with reason
- pending: write-back needs user confirmation; final response should include proposed path

You can also set SEMO_KB_WRITEBACK_STATUS=written|not-needed|pending.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "::error::unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$STATUS" in
  ""|written|not-needed|pending) ;;
  *)
    echo "::error::invalid KB write-back status: $STATUS" >&2
    exit 2
    ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "::error::not inside a git worktree" >&2
  exit 2
fi

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "::error::base ref not found: $BASE_REF" >&2
  exit 2
fi

DIFF="$(git diff --unified=0 "$BASE_REF" -- . ':!package-lock.json' ':!**/package-lock.json' ':!pnpm-lock.yaml' ':!yarn.lock')"

if [[ -z "$DIFF" ]]; then
  echo "KB write-back check: no working-tree diff."
  exit 0
fi

PATTERN='(SALT|level[-_ ]?test|레벨|평가|score|scoring|category|카테고리|recommend|추천|policy|정책|routing|route|라우팅|owner|role|담당|status|lifecycle|metadata|title|label|CTA|service_url|repo|slack_channel|permissionMode|defaultMode|agent|bot|skill|프로세스|decision|결정|이름|rename|renamed)'

MATCHES="$(printf '%s\n' "$DIFF" | grep -E '^[+-][^+-]' | grep -E -i "$PATTERN" || true)"

if [[ -z "$MATCHES" ]]; then
  echo "KB write-back check: no durable-change keyword detected."
  exit 0
fi

echo "KB write-back check: possible durable change detected."
printf '%s\n' "$MATCHES" | sed -n '1,40p'

if [[ -n "$STATUS" ]]; then
  echo "KB write-back status: $STATUS"
  exit 0
fi

cat >&2 <<'EOF'
::error::possible durable SEMO/Semicolon change without explicit KB write-back status.
Set one of:
  SEMO_KB_WRITEBACK_STATUS=written
  SEMO_KB_WRITEBACK_STATUS=not-needed
  SEMO_KB_WRITEBACK_STATUS=pending

Final response must include a KB line with the path, reason, or pending proposal.
EOF
exit 1
