#!/bin/bash
# Durable launcher for the SemiColony KB gateway (LaunchAgent target).
# Sources DB/embedding creds from ~/.claude/semo/.env, binds 127.0.0.1:18810.
# Secret: ~/.semo/secrets/kb-gateway.key (created by setup). Internal-only bind.
set -euo pipefail

if [ -f "$HOME/.claude/semo/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$HOME/.claude/semo/.env"
  set +a
fi

export KB_GATEWAY_HOST="${KB_GATEWAY_HOST:-127.0.0.1}"
export KB_GATEWAY_PORT="${KB_GATEWAY_PORT:-18810}"

# Repo accessed via the stable ASCII symlink (~/semo-repo) to dodge the
# iCloud/unicode repo path. See memory: semo-repo-icloud-relocation.
cd "$HOME/semo-repo/packages/kb-gateway"
exec npx tsx src/server.ts
