#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOLO_DIR="$ROOT_DIR/packages/cli-solo"
BUNDLE="$SOLO_DIR/dist/bundle.js"

cd "$SOLO_DIR"
npm run build

if [[ ! -f "$BUNDLE" ]]; then
  echo "::error::cli-solo bundle missing: $BUNDLE"
  exit 1
fi

for forbidden in 'require("pg")' 'discord.js' '@slack/bolt' '@slack/web-api'; do
  if grep -Fq "$forbidden" "$BUNDLE"; then
    echo "::error::cli-solo bundle leaked $forbidden"
    exit 1
  fi
done

echo "cli-solo bundle purity OK"

