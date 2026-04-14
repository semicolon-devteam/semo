#!/usr/bin/env bash
# semo-agents-start.sh — Launch Architecture B: Multi-session cmux agents
set -euo pipefail

SEMO_ROOT="$HOME/Desktop/Sources/semicolon/projects/semo"
SESSION_DIR="$HOME/.semo-bot-sessions"
MAILBOX_DIR="$HOME/.semo-mailbox"
PID_FILE="$HOME/.semo-agents.pid"
WORKSPACE="semo-agents"
BOT_CONFIG_DIR="$HOME/.claude/snamanager0"  # 봇 전용 계정 (reus7042와 분리)

BOTS=(semiclaw planclaw designclaw workclaw reviewclaw infraclaw growthclaw)

# ── Pre-flight checks ──

echo "[start] Pre-flight checks..."

# Check cmux
if ! command -v cmux &>/dev/null; then
  echo "[ERROR] cmux not found. Install cmux first."
  exit 1
fi

# Check env vars
source "$HOME/.claude/semo/.env" 2>/dev/null || true
for var in SLACK_BOT_TOKEN SLACK_APP_TOKEN DATABASE_URL; do
  if [ -z "${!var:-}" ]; then
    echo "[ERROR] Missing env var: $var"
    exit 1
  fi
done

# Discord is optional
DISCORD_ENABLED=false
if [ -n "${DISCORD_BOT_TOKEN:-}" ]; then
  DISCORD_ENABLED=true
  echo "[start] Discord Router enabled (DISCORD_BOT_TOKEN found)"
else
  echo "[start] Discord Router disabled (no DISCORD_BOT_TOKEN)"
fi

# Check if already running
if cmux list-workspaces 2>/dev/null | grep -q "$WORKSPACE"; then
  echo "[ERROR] Workspace '$WORKSPACE' already exists. Run semo-agents-stop.sh first, or use --force"
  if [ "${1:-}" != "--force" ]; then
    exit 1
  fi
  echo "[WARN] --force: closing existing workspace..."
  bash "$SEMO_ROOT/scripts/semo-agents-stop.sh" 2>/dev/null || true
  sleep 3
fi

# Clear shutdown flag
rm -f "$MAILBOX_DIR/_shutdown"

# ── Generate bot environments ──

echo "[start] Generating bot environments..."
node "$SEMO_ROOT/scripts/generate-bot-env.js" --all --session-dir "$SESSION_DIR" --mailbox-dir "$MAILBOX_DIR"

# ── Ensure mailbox directories ──

for bot in "${BOTS[@]}"; do
  mkdir -p "$MAILBOX_DIR/$bot/archive"
  touch "$MAILBOX_DIR/$bot/inbox.jsonl"
  touch "$MAILBOX_DIR/$bot/outbox.jsonl"
  touch "$MAILBOX_DIR/$bot/inbox.consumed"
done

# ── Install deps if needed ──

if [ ! -d "$SEMO_ROOT/packages/agent-mailbox/node_modules" ]; then
  echo "[start] Installing agent-mailbox dependencies..."
  (cd "$SEMO_ROOT/packages/agent-mailbox" && npm install --quiet)
fi

if $DISCORD_ENABLED && [ ! -d "$SEMO_ROOT/packages/discord-router/node_modules" ]; then
  echo "[start] Installing discord-router dependencies..."
  (cd "$SEMO_ROOT/packages/discord-router" && npm install --quiet)
fi

# ── Create cmux workspace ──

echo "[start] Creating cmux workspace: $WORKSPACE"
cmux create-workspace --title "$WORKSPACE" 2>/dev/null || true

# ── Pane 0: Slack Router ──

# Calculate pane offset before starting routers
BOT_PANE_OFFSET=1
if $DISCORD_ENABLED; then
  BOT_PANE_OFFSET=2
fi

echo "[start] Starting Slack Router (pane 0)..."
cmux send --workspace "$WORKSPACE" \
  "cd $SEMO_ROOT && set -a && source $HOME/.claude/semo/.env && set +a && SEMO_MAILBOX_DIR=$MAILBOX_DIR SEMO_SESSION_DIR=$SESSION_DIR SEMO_SURFACE_MAP=/tmp/semo-surface-map.json SEMO_BOT_PANE_OFFSET=$BOT_PANE_OFFSET npx tsx packages/slack-router/src/index.ts\n"

sleep 3  # Let router connect to Slack

# ── Pane 1: Discord Router (optional) ──

if $DISCORD_ENABLED; then
  echo "[start] Starting Discord Router (pane 1)..."
  cmux split --workspace "$WORKSPACE" --direction down 2>/dev/null || \
    cmux new-surface --workspace "$WORKSPACE" 2>/dev/null || true
  cmux send --workspace "$WORKSPACE" --surface "pane:1" \
    "cd $SEMO_ROOT && set -a && source $HOME/.claude/semo/.env && set +a && SEMO_MAILBOX_DIR=$MAILBOX_DIR SEMO_SESSION_DIR=$SESSION_DIR SEMO_SURFACE_MAP=/tmp/semo-surface-map.json SEMO_BOT_PANE_OFFSET=$BOT_PANE_OFFSET npx tsx packages/discord-router/src/index.ts\n"
  sleep 3
fi

# ── Pane N+: Bot sessions ──

for i in "${!BOTS[@]}"; do
  bot="${BOTS[$i]}"
  pane_idx=$((i + BOT_PANE_OFFSET))

  echo "[start] Starting $bot (pane $pane_idx)..."

  # Create new pane
  cmux split --workspace "$WORKSPACE" --direction down 2>/dev/null || \
    cmux new-surface --workspace "$WORKSPACE" 2>/dev/null || true

  # Launch Claude Code (snamanager0 계정으로 실행)
  cmux send --workspace "$WORKSPACE" --surface "pane:$pane_idx" \
    "cd $SESSION_DIR/$bot && CLAUDE_CONFIG_DIR=$BOT_CONFIG_DIR claude --permission-mode bypassPermissions\n"

  sleep 2  # Stagger startup to avoid rate limit burst
done

# ── Generate surface map (for nudge) ──

echo "[start] Generating surface map..."
python3 -c "
import json, sys
bots = '${BOTS[*]}'.split()
offset = $BOT_PANE_OFFSET
surfaces = {bot: f'pane:{i+offset}' for i, bot in enumerate(bots)}
data = {'workspace': '$WORKSPACE', 'surfaces': surfaces}
with open('/tmp/semo-surface-map.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f'  Surface map: {len(surfaces)} bots, offset={offset}')
"

# ── Health gate: wait for heartbeats ──

echo "[start] Waiting for bot heartbeats (up to 60s)..."
DEADLINE=$((SECONDS + 60))
READY=0

while [ $SECONDS -lt $DEADLINE ]; do
  READY=0
  for bot in "${BOTS[@]}"; do
    if [ -f "$MAILBOX_DIR/$bot/heartbeat" ]; then
      READY=$((READY + 1))
    fi
  done

  if [ $READY -eq ${#BOTS[@]} ]; then
    break
  fi

  echo "  $READY/${#BOTS[@]} bots ready..."
  sleep 5
done

if [ $READY -lt ${#BOTS[@]} ]; then
  echo "[WARN] Only $READY/${#BOTS[@]} bots sent heartbeat. Health monitor will restart laggards."
else
  echo "[start] All ${#BOTS[@]} bots ready!"
fi

# ── Write PID file ──

echo $$ > "$PID_FILE"

echo ""
echo "==================================="
echo " SEMO Agents (Architecture B)"
echo " Slack Router: pane 0"
if $DISCORD_ENABLED; then
echo " Discord Router: pane 1"
fi
echo " Bots: pane ${BOT_PANE_OFFSET}-$((${#BOTS[@]} + BOT_PANE_OFFSET - 1))"
echo " Mailbox: $MAILBOX_DIR"
echo " Sessions: $SESSION_DIR"
echo "==================================="
echo ""
echo "Use 'cmux tree --workspace $WORKSPACE' to see all panes."
echo "Use 'scripts/semo-agents-stop.sh' to stop."
