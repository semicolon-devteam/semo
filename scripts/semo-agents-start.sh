#!/usr/bin/env zsh
# semo-agents-start.sh — Launch Architecture B: Multi-session cmux agents
set -euo pipefail

SEMO_ROOT="$HOME/Desktop/Sources/semicolon/projects/semo"
SESSION_DIR="$HOME/.semo/sessions"
MAILBOX_DIR="$HOME/.semo/mailbox"
PID_FILE="$HOME/.semo/agents.pid"
WORKSPACE="SEMO Agents"
BOT_CONFIG_DIR="$HOME/.claude/snamanager0"  # 봇 전용 계정 (reus7042와 분리)

BOTS=(semiclaw planclaw designclaw workclaw reviewclaw infraclaw growthclaw incubator)
OVERFLOW_BOTS=(semiclaw-overflow)

# ── Pre-flight checks ──

echo "[start] Pre-flight checks..."

if ! command -v cmux &>/dev/null; then
  echo "[ERROR] cmux not found. Install cmux first."
  exit 1
fi

source "$HOME/.claude/semo/.env" 2>/dev/null || true
for var in SLACK_BOT_TOKEN SLACK_APP_TOKEN DATABASE_URL; do
  if [ -z "${(P)var:-}" ]; then
    echo "[ERROR] Missing env var: $var"
    exit 1
  fi
done

DISCORD_ENABLED=false
if [ -n "${DISCORD_BOT_TOKEN:-}" ]; then
  DISCORD_ENABLED=true
  echo "[start] Discord Router enabled"
else
  echo "[start] Discord Router disabled"
fi

# Check if already running
if cmux list-workspaces 2>/dev/null | grep -qF "$WORKSPACE"; then
  echo "[ERROR] Workspace '$WORKSPACE' already exists. Run semo-agents-stop.sh first, or use --force"
  if [ "${1:-}" != "--force" ]; then
    exit 1
  fi
  echo "[WARN] --force: closing existing workspace..."
  bash "$SEMO_ROOT/scripts/semo-agents-stop.sh" 2>/dev/null || true
  sleep 3
fi

rm -f "$MAILBOX_DIR/_shutdown"

# ── Generate bot environments ──

echo "[start] Generating bot environments..."
node "$SEMO_ROOT/scripts/generate-bot-env.js" --all --session-dir "$SESSION_DIR" --mailbox-dir "$MAILBOX_DIR"

# ── Ensure mailbox directories ──

for bot in "${BOTS[@]}" "${OVERFLOW_BOTS[@]}"; do
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

echo "[start] Creating cmux workspace..."
WORKSPACE_REF=$(cmux new-workspace 2>/dev/null | grep -oE 'workspace:[0-9]+')
cmux rename-workspace --workspace "$WORKSPACE_REF" "$WORKSPACE" 2>/dev/null || true
echo "[start] Workspace: $WORKSPACE_REF"

# ── Helper: create split and capture surface ID ──

# Collect surface IDs: SURFACES[label] = "surface:N"
declare -A SURFACES

# Pane 0 is the initial surface in the workspace
INITIAL_SURFACE=$(cmux tree --workspace "$WORKSPACE_REF" 2>/dev/null | grep -oE 'surface:[0-9]+' | head -1)
SURFACES[router]="$INITIAL_SURFACE"

create_split() {
  local label="$1"
  local output
  output=$(cmux new-split --workspace "$WORKSPACE_REF" down 2>&1) || true
  # Output format: "OK surface:79 workspace:8" or "OK surface:79 pane:52 workspace:8"
  local surface_id
  surface_id=$(echo "$output" | grep -oE 'surface:[0-9]+')
  if [ -n "$surface_id" ]; then
    SURFACES[$label]="$surface_id"
    echo "  Split created: $label → $surface_id"
  else
    echo "  [WARN] Failed to create split for $label: $output"
  fi
}

# ── Pane 0: Slack Router ──

echo "[start] Starting Slack Router..."
cmux send --workspace "$WORKSPACE_REF" --surface "${SURFACES[router]}" \
  $'cd '"$SEMO_ROOT"' && set -a && source '"$HOME"'/.claude/semo/.env && set +a && SEMO_MAILBOX_DIR='"$MAILBOX_DIR"' SEMO_SESSION_DIR='"$SESSION_DIR"' SEMO_SURFACE_MAP=/tmp/semo-surface-map.json npx tsx packages/slack-router/src/index.ts\n'

sleep 3

# ── Discord Router (optional) ──

if $DISCORD_ENABLED; then
  echo "[start] Starting Discord Router..."
  create_split "discord-router"
  cmux send --workspace "$WORKSPACE_REF" --surface "${SURFACES[discord-router]}" \
    $'cd '"$SEMO_ROOT"' && set -a && source '"$HOME"'/.claude/semo/.env && set +a && SEMO_MAILBOX_DIR='"$MAILBOX_DIR"' SEMO_SESSION_DIR='"$SESSION_DIR"' SEMO_SURFACE_MAP=/tmp/semo-surface-map.json npx tsx packages/discord-router/src/index.ts\n'
  sleep 3
fi

# ── Bot sessions ──

for bot in "${BOTS[@]}"; do
  echo "[start] Starting $bot..."
  create_split "$bot"
  cmux send --workspace "$WORKSPACE_REF" --surface "${SURFACES[$bot]}" \
    $'cd '"$SESSION_DIR/$bot"' && CLAUDE_CONFIG_DIR='"$BOT_CONFIG_DIR"' claude --permission-mode bypassPermissions\n'
  sleep 2
done

# ── Overflow bot sessions ──

for bot in "${OVERFLOW_BOTS[@]}"; do
  echo "[start] Starting $bot..."
  create_split "$bot"
  cmux send --workspace "$WORKSPACE_REF" --surface "${SURFACES[$bot]}" \
    $'cd '"$SESSION_DIR/$bot"' && CLAUDE_CONFIG_DIR='"$BOT_CONFIG_DIR"' claude --permission-mode bypassPermissions\n'
  sleep 2
done

# ── Generate surface map (for nudge) ──

echo "[start] Generating surface map..."
{
  echo "{"
  echo "  \"workspace\": \"$WORKSPACE_REF\","
  echo "  \"surfaces\": {"
  first=true
  for bot in "${BOTS[@]}" "${OVERFLOW_BOTS[@]}"; do
    if [ -n "${SURFACES[$bot]:-}" ]; then
      if $first; then first=false; else echo ","; fi
      printf '    "%s": "%s"' "$bot" "${SURFACES[$bot]}"
    fi
  done
  echo ""
  echo "  }"
  echo "}"
} > /tmp/semo-surface-map.json
echo "  Surface map: $(cat /tmp/semo-surface-map.json | grep -c 'surface:') bots"

# ── Health gate: wait for heartbeats ──

ALL_BOTS=("${BOTS[@]}" "${OVERFLOW_BOTS[@]}")
TOTAL_BOTS=${#ALL_BOTS[@]}

echo "[start] Waiting for bot heartbeats (up to 90s)..."
DEADLINE=$((SECONDS + 90))
READY=0

while [ $SECONDS -lt $DEADLINE ]; do
  READY=0
  for bot in "${ALL_BOTS[@]}"; do
    if [ -f "$MAILBOX_DIR/$bot/heartbeat" ]; then
      READY=$((READY + 1))
    fi
  done

  if [ $READY -eq $TOTAL_BOTS ]; then
    break
  fi

  echo "  $READY/$TOTAL_BOTS bots ready..."
  sleep 5
done

if [ $READY -lt $TOTAL_BOTS ]; then
  echo "[WARN] Only $READY/$TOTAL_BOTS bots sent heartbeat. Health monitor will restart laggards."
else
  echo "[start] All $TOTAL_BOTS bots ready!"
fi

echo $$ > "$PID_FILE"

echo ""
echo "==================================="
echo " SEMO Agents (Architecture B)"
echo " Workspace: $WORKSPACE_REF"
echo " Bots: ${BOTS[*]}"
echo " Overflow: ${OVERFLOW_BOTS[*]}"
echo " Mailbox: $MAILBOX_DIR"
echo " Sessions: $SESSION_DIR"
echo "==================================="
echo ""
echo "Surface map: /tmp/semo-surface-map.json"
echo "Use 'cmux tree --workspace $WORKSPACE_REF' to see all panes."
echo "Use 'scripts/semo-agents-stop.sh' to stop."
