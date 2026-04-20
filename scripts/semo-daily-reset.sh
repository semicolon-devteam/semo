#!/usr/bin/env bash
# semo-daily-reset.sh — Daily context rotation (04:00 KST cron)
# Crontab: 0 19 * * * /path/to/semo-daily-reset.sh >> ~/.semo/mailbox/daily-reset.log 2>&1
set -euo pipefail

SEMO_ROOT="$HOME/Desktop/Sources/semicolon/projects/semo"
MAILBOX_DIR="$HOME/.semo/mailbox"
DATE=$(date +%Y-%m-%d)

BOTS=(semiclaw planclaw designclaw workclaw reviewclaw infraclaw growthclaw)

echo ""
echo "=== Daily Reset: $DATE $(date +%H:%M:%S) ==="

# 1. Stop agents
echo "[reset] Stopping agents..."
bash "$SEMO_ROOT/scripts/semo-agents-stop.sh" 2>&1 || true

# 2. Wait for all heartbeats to go stale
echo "[reset] Waiting for full shutdown..."
for attempt in {1..6}; do
  ALL_STALE=true
  for bot in "${BOTS[@]}"; do
    HB_FILE="$MAILBOX_DIR/$bot/heartbeat"
    if [ -f "$HB_FILE" ]; then
      HB_AGE=$(( $(date +%s) - $(date -r "$HB_FILE" +%s 2>/dev/null || echo 0) ))
      if [ "$HB_AGE" -lt 30 ]; then
        ALL_STALE=false
        break
      fi
    fi
  done
  $ALL_STALE && break
  echo "  Attempt $attempt/6 — waiting 10s..."
  sleep 10
done

# 3. Archive mailbox files
echo "[reset] Archiving mailbox data..."
for bot in "${BOTS[@]}"; do
  BOT_DIR="$MAILBOX_DIR/$bot"

  # Archive inbox
  if [ -s "$BOT_DIR/inbox.jsonl" ]; then
    mv "$BOT_DIR/inbox.jsonl" "$BOT_DIR/archive/inbox-$DATE.jsonl"
  fi

  # Archive outbox
  if [ -s "$BOT_DIR/outbox.jsonl" ]; then
    mv "$BOT_DIR/outbox.jsonl" "$BOT_DIR/archive/outbox-$DATE.jsonl"
  fi

  # Reset files
  : > "$BOT_DIR/inbox.jsonl"
  : > "$BOT_DIR/outbox.jsonl"
  : > "$BOT_DIR/inbox.consumed"

  # Clear _current (no in-progress messages after reset)
  rm -f "$BOT_DIR/_current"
  rm -f "$BOT_DIR/_compact_needed"

  # Delete archives older than 7 days
  find "$BOT_DIR/archive/" -name "*.jsonl" -mtime +7 -delete 2>/dev/null || true
done
echo "  Done."

# 4. Restart agents with smoke test
echo "[reset] Restarting agents..."
bash "$SEMO_ROOT/scripts/semo-agents-start.sh" --smoke 2>&1 || true

echo "=== Daily Reset Complete: $(date +%H:%M:%S) ==="
