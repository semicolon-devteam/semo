#!/usr/bin/env bash
# semo-agents-stop.sh — Graceful shutdown of Architecture B agents
set -euo pipefail

MAILBOX_DIR="$HOME/.semo-mailbox"
PID_FILE="$HOME/.semo-agents.pid"
WORKSPACE="semo-agents"

BOTS=(semiclaw planclaw designclaw workclaw reviewclaw infraclaw growthclaw)

echo "[stop] Stopping SEMO Agents..."

# 1. Signal shutdown
touch "$MAILBOX_DIR/_shutdown"
echo "  Shutdown flag set"

# 2. Send /quit to each bot (reverse order)
for i in $(seq ${#BOTS[@]} -1 1); do
  bot="${BOTS[$((i - 1))]}"
  echo "  Stopping $bot (pane $i)..."
  cmux send --workspace "$WORKSPACE" --surface "pane:$i" "/quit\n" 2>/dev/null || true
  sleep 1
done

# 3. Wait for bots to flush (agent-flush hooks)
echo "  Waiting 5s for agent-flush hooks..."
sleep 5

# 4. Stop Router (pane 0)
echo "  Stopping Router (pane 0)..."
# Send Ctrl+C
cmux send --workspace "$WORKSPACE" --surface "pane:0" '\x03' 2>/dev/null || true
sleep 2

# 5. Close workspace
echo "  Closing workspace..."
cmux close-workspace "$WORKSPACE" 2>/dev/null || true

# 6. Verify heartbeats are stale
echo "  Verifying shutdown..."
ALL_STOPPED=true
for bot in "${BOTS[@]}"; do
  HB_FILE="$MAILBOX_DIR/$bot/heartbeat"
  if [ -f "$HB_FILE" ]; then
    # Check if heartbeat is older than 30 seconds
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

# 7. Cleanup
rm -f "$PID_FILE"
rm -f "$MAILBOX_DIR/_shutdown"

echo "[stop] Done."
