#!/usr/bin/env bash
# e2e-smoke.sh — Synthetic inbox injection test (no Slack needed)
# Tests: inbox write → MCP check_inbox → Claude processing → outbox write
set -euo pipefail

MAILBOX_DIR="$HOME/.semo/mailbox"
BOT="semiclaw"
INBOX="$MAILBOX_DIR/$BOT/inbox.jsonl"
OUTBOX="$MAILBOX_DIR/$BOT/outbox.jsonl"
HEARTBEAT="$MAILBOX_DIR/$BOT/heartbeat"

echo "=== E2E Smoke Test ==="
echo ""

# 1. Check prerequisites
echo "[1/5] Checking prerequisites..."
if [ ! -d "$MAILBOX_DIR/$BOT" ]; then
  echo "  Creating mailbox directory..."
  mkdir -p "$MAILBOX_DIR/$BOT/archive"
  touch "$INBOX" "$OUTBOX" "$MAILBOX_DIR/$BOT/inbox.consumed"
fi

if [ ! -f "$HOME/.semo/sessions/$BOT/.mcp.json" ]; then
  echo "  [ERROR] Bot environment not generated. Run: node scripts/generate-bot-env.js --bot $BOT"
  exit 1
fi

echo "  OK"

# 2. Check if bot session is running (heartbeat)
echo "[2/5] Checking bot session..."
if [ -f "$HEARTBEAT" ]; then
  HB_AGE=$(( $(date +%s) - $(date -r "$HEARTBEAT" +%s 2>/dev/null || echo 0) ))
  if [ "$HB_AGE" -lt 120 ]; then
    echo "  Bot is running (heartbeat $HB_AGE s ago)"
  else
    echo "  [WARN] Bot heartbeat is stale ($HB_AGE s). Start the bot session first:"
    echo "    cd ~/.semo/sessions/$BOT && claude --permission-mode bypassPermissions"
    exit 1
  fi
else
  echo "  [WARN] No heartbeat file. Start the bot session first:"
  echo "    cd ~/.semo/sessions/$BOT && claude --permission-mode bypassPermissions"
  exit 1
fi

# 3. Record outbox size before injection
OUTBOX_SIZE_BEFORE=$(wc -c < "$OUTBOX" 2>/dev/null || echo 0)
echo "  Outbox size before: $OUTBOX_SIZE_BEFORE bytes"

# 4. Inject synthetic inbox message
echo "[3/5] Injecting synthetic message..."
MSG_ID="smoke-$(date +%s)"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat >> "$INBOX" << EOF
{"id":"$MSG_ID","timestamp":"$TIMESTAMP","type":"slack_message","priority":"normal","slack_channel":"C_SMOKE_TEST","slack_thread_ts":"","slack_message_ts":"$MSG_ID","sender_name":"SmokeTest","sender_id":"U_SMOKE","text":"ping — 이것은 E2E 스모크 테스트입니다. 간단히 pong으로 응답해주세요.","route_reason":"test","service_domain":"semo"}
EOF

echo "  Injected message: $MSG_ID"

# 5. Wait for outbox response (up to 60s)
echo "[4/5] Waiting for bot response (up to 60s)..."
DEADLINE=$((SECONDS + 60))

while [ $SECONDS -lt $DEADLINE ]; do
  OUTBOX_SIZE_NOW=$(wc -c < "$OUTBOX" 2>/dev/null || echo 0)
  if [ "$OUTBOX_SIZE_NOW" -gt "$OUTBOX_SIZE_BEFORE" ]; then
    echo "  Response detected!"
    echo ""

    # Show the new outbox entries
    echo "[5/5] Response:"
    tail -c +$((OUTBOX_SIZE_BEFORE + 1)) "$OUTBOX" | while IFS= read -r line; do
      # Pretty print key fields
      echo "  $(echo "$line" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f\"type={d.get('type')} bot={d.get('bot_id')} reply_to={d.get('in_reply_to','')[:12]}...\")
    if d.get('text'):
        print(f\"  text: {d['text'][:200]}\")
except:
    print(sys.stdin.read()[:200])
" 2>/dev/null || echo "$line" | head -c 200)"
    done

    echo ""
    echo "=== SMOKE TEST PASSED ==="
    exit 0
  fi

  sleep 2
  echo -n "."
done

echo ""
echo "=== SMOKE TEST FAILED — No response within 60s ==="
echo "Check bot session logs. The injected message ID: $MSG_ID"
exit 1
