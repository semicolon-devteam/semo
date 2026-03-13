#!/usr/bin/env bash
# validate-bot-config.sh — Validate an OpenClaw bot's openclaw.json
# Usage: bash validate-bot-config.sh <path-to-openclaw.json>

set -euo pipefail

CONFIG="${1:-}"
if [[ -z "$CONFIG" || ! -f "$CONFIG" ]]; then
  echo "❌ Usage: $0 <path-to-openclaw.json>"
  exit 1
fi

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1" result="$2"
  if [[ "$result" == "pass" ]]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  elif [[ "$result" == "warn" ]]; then
    echo "  ⚠️  $label"
    WARN=$((WARN + 1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "🔍 Validating: $CONFIG"
echo ""

# Check JSON validity
if ! jq empty "$CONFIG" 2>/dev/null; then
  echo "❌ Invalid JSON"
  exit 1
fi
check "Valid JSON" "pass"

# gateway.auth.token
TOKEN=$(jq -r '.gateway.auth.token // empty' "$CONFIG")
if [[ -n "$TOKEN" ]]; then
  check "gateway.auth.token exists" "pass"
else
  check "gateway.auth.token MISSING — gateway will not start" "fail"
fi

# channels.slack.groupPolicy
GP=$(jq -r '.channels.slack.groupPolicy // empty' "$CONFIG")
if [[ "$GP" == "open" ]]; then
  check "groupPolicy is \"open\"" "pass"
elif [[ "$GP" == "allowlist" ]]; then
  check "groupPolicy is \"allowlist\" — MUST be \"open\"" "fail"
else
  check "groupPolicy not set — should be \"open\"" "fail"
fi

# #bot-ops channel allowBots (read early for fallback check)
BOTOPS_AB=$(jq -r '.channels.slack.channels["C0AFBQ209E0"].allowBots // empty' "$CONFIG")

# channels.slack.allowBots
AB=$(jq -r '.channels.slack.allowBots // empty' "$CONFIG")
if [[ "$AB" == "true" ]]; then
  check "channels.slack.allowBots is true" "pass"
elif [[ "$BOTOPS_AB" == "true" ]]; then
  check "channels.slack.allowBots is false (bot comms work via per-channel override)" "warn"
else
  check "channels.slack.allowBots not true — bot-to-bot comms disabled" "fail"
fi
if [[ "$BOTOPS_AB" == "true" ]]; then
  check "#bot-ops (C0AFBQ209E0) allowBots is true" "pass"
else
  check "#bot-ops (C0AFBQ209E0) allowBots not set — bot comms in #bot-ops may fail" "warn"
fi

# plugins.entries.slack.enabled
SLACK_ENABLED=$(jq -r '.plugins.entries.slack.enabled // empty' "$CONFIG")
if [[ "$SLACK_ENABLED" == "true" ]]; then
  check "plugins.entries.slack.enabled is true" "pass"
else
  check "plugins.entries.slack.enabled not true — Slack won't connect" "fail"
fi

# messages.ackReaction
ACK=$(jq -r '.messages.ackReaction // empty' "$CONFIG")
if [[ -n "$ACK" ]]; then
  check "messages.ackReaction set (\"$ACK\")" "pass"
else
  check "messages.ackReaction not set — no auto-reaction on mention" "warn"
fi

# messages.ackReactionScope
SCOPE=$(jq -r '.messages.ackReactionScope // empty' "$CONFIG")
if [[ "$SCOPE" == "all" ]]; then
  check "messages.ackReactionScope is \"all\"" "pass"
elif [[ -n "$SCOPE" ]]; then
  check "messages.ackReactionScope is \"$SCOPE\" (recommended: \"all\")" "warn"
else
  check "messages.ackReactionScope not set" "warn"
fi

# channels.slack.dm.allowFrom
DM_COUNT=$(jq -r '.channels.slack.dm.allowFrom | length // 0' "$CONFIG" 2>/dev/null || echo "0")
if [[ "$DM_COUNT" -gt 0 ]]; then
  check "channels.slack.dm.allowFrom has $DM_COUNT entries" "pass"
else
  check "channels.slack.dm.allowFrom empty or missing — DM access may be restricted" "warn"
fi

# auth.profiles
AUTH=$(jq -r '.auth.profiles // empty' "$CONFIG")
if [[ -n "$AUTH" && "$AUTH" != "null" ]]; then
  check "auth.profiles configured (standard)" "pass"
elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  check "auth.profiles not in config — using ANTHROPIC_API_KEY env var (non-standard, recommend migrating to auth.profiles)" "warn"
else
  check "auth.profiles not set and no ANTHROPIC_API_KEY env var — bot can't call LLM" "fail"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ✅ $PASS pass | ❌ $FAIL fail | ⚠️  $WARN warn"
if [[ $FAIL -gt 0 ]]; then
  echo "  Status: FAIL"
  exit 1
else
  echo "  Status: PASS"
  exit 0
fi
