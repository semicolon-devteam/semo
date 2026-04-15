#!/usr/bin/env bash
# semo-agents-stop.sh — Graceful shutdown of Architecture B agents
set -euo pipefail

MAILBOX_DIR="$HOME/.semo/mailbox"
PID_FILE="$HOME/.semo/agents.pid"
WORKSPACE_TITLE="SEMO Agents"

BOTS=(semiclaw planclaw designclaw workclaw reviewclaw infraclaw growthclaw)
OVERFLOW_BOTS=(semiclaw-overflow)

echo "[stop] Stopping SEMO Agents..."

# Resolve workspace ref by title
WORKSPACE_REF=$(cmux list-workspaces 2>/dev/null | grep -F "$WORKSPACE_TITLE" | awk '{print $1}' || true)
if [ -z "$WORKSPACE_REF" ]; then
  echo "[ERROR] Workspace '$WORKSPACE_TITLE' not found."
  exit 1
fi
echo "  Workspace: $WORKSPACE_REF"

# 1. Signal shutdown
touch "$MAILBOX_DIR/_shutdown"
echo "  Shutdown flag set"

# 2. Send /quit to each bot (reverse order, detect pane offset)
# Discord Router present → bots at pane 2+, otherwise pane 1+
TOTAL_PANES=$(cmux tree --workspace "$WORKSPACE_REF" 2>/dev/null | grep -c "pane:" || echo 0)
BOT_PANE_OFFSET=1
if [ "$TOTAL_PANES" -gt $((${#BOTS[@]} + 1)) ]; then
  BOT_PANE_OFFSET=2  # Discord Router occupies pane 1
fi

# Stop overflow bots first
OVERFLOW_PANE_OFFSET=$((${#BOTS[@]} + BOT_PANE_OFFSET))
for i in $(seq ${#OVERFLOW_BOTS[@]} -1 1); do
  bot="${OVERFLOW_BOTS[$((i - 1))]}"
  pane=$((i - 1 + OVERFLOW_PANE_OFFSET))
  echo "  Stopping $bot (pane $pane)..."
  cmux send --workspace "$WORKSPACE_REF" --surface "pane:$pane" "/quit\n" 2>/dev/null || true
  sleep 1
done

for i in $(seq ${#BOTS[@]} -1 1); do
  bot="${BOTS[$((i - 1))]}"
  pane=$((i - 1 + BOT_PANE_OFFSET))
  echo "  Stopping $bot (pane $pane)..."
  cmux send --workspace "$WORKSPACE_REF" --surface "pane:$pane" "/quit\n" 2>/dev/null || true
  sleep 1
done

# 3. Wait for bots to flush (agent-flush hooks)
echo "  Waiting 5s for agent-flush hooks..."
sleep 5

# 4. Stop Discord Router (pane 1, if present)
if [ "$BOT_PANE_OFFSET" -eq 2 ]; then
  echo "  Stopping Discord Router (pane 1)..."
  cmux send --workspace "$WORKSPACE_REF" --surface "pane:1" $'\x03' 2>/dev/null || true
  sleep 1
fi

# 5. Stop Slack Router (pane 0)
echo "  Stopping Slack Router (pane 0)..."
cmux send --workspace "$WORKSPACE_REF" --surface "pane:0" $'\x03' 2>/dev/null || true
sleep 2

# 6. Close workspace
echo "  Closing workspace..."
cmux close-workspace --workspace "$WORKSPACE_REF" 2>/dev/null || true

# 7. Verify heartbeats are stale
echo "  Verifying shutdown..."
ALL_STOPPED=true
for bot in "${BOTS[@]}" "${OVERFLOW_BOTS[@]}"; do
  HB_FILE="$MAILBOX_DIR/$bot/heartbeat"
  if [ -f "$HB_FILE" ]; then
    HB_AGE=$(( $(date +%s) - $(date -r "$HB_FILE" +%s 2>/dev/null || echo 0) ))
    if [ "$HB_AGE" -lt 30 ]; then
      echo "  [WARN] $bot heartbeat still fresh ($HB_AGE s ago)"
      ALL_STOPPED=false
    fi
  fi
done

if $ALL_STOPPED; then
  echo "  All bots stopped."
else
  echo "  [WARN] Some bots may still be running. Check 'cmux list-workspaces'."
fi

# 8. Cleanup
rm -f "$PID_FILE"
rm -f "$MAILBOX_DIR/_shutdown"

echo "[stop] Done."
