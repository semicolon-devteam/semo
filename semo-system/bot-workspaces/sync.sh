#!/bin/bash
# Bot Workspaces Auto Sync
# Usage: ./sync.sh [--dry-run]
# Commits and pushes any changes in bot workspaces

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

# Check for changes in bot-workspaces
if git diff --quiet semo-system/bot-workspaces/ && git diff --cached --quiet semo-system/bot-workspaces/; then
  # Check for untracked files
  UNTRACKED=$(git ls-files --others --exclude-standard semo-system/bot-workspaces/ | head -1)
  if [ -z "$UNTRACKED" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') No changes in bot-workspaces"
    exit 0
  fi
fi

if [ "${1:-}" = "--dry-run" ]; then
  echo "Changes detected (dry run):"
  git status --short semo-system/bot-workspaces/
  exit 0
fi

# Stage and commit
git add semo-system/bot-workspaces/
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "chore(bot-workspaces): auto-sync $TIMESTAMP" --no-verify 2>/dev/null || true

# Push
git push origin HEAD 2>/dev/null && echo "$(date '+%Y-%m-%d %H:%M:%S') Synced and pushed" || echo "$(date '+%Y-%m-%d %H:%M:%S') Committed locally, push failed"
