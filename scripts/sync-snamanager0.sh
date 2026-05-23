#!/usr/bin/env bash
# sync-snamanager0.sh — bot 전용 Claude 계정 (snamanager0) 의 공유 리소스 동기화
#
# 배경: cron-poller Claude 세션 (CLAUDE_CONFIG_DIR=~/.claude/snamanager0) 이
# Task(subagent_type=semiclaw) 같은 fan-out 을 하려면 봇 페르소나 정의가 같은
# 디렉토리 트리 아래 있어야 한다. reus 본 계정 (~/.claude/agents/, ~/.claude/skills/) 을
# SoT 로 두고 snamanager0 측에는 심볼릭 링크만 둔다.
#
# 멱등 — 이미 올바른 링크면 no-op, 잘못된 실체면 백업 후 교체, 누락이면 생성.

set -euo pipefail

REUS_HOME="$HOME/.claude"
BOT_HOME="$HOME/.claude/snamanager0"

if [ ! -d "$BOT_HOME" ]; then
  echo "[sync-snamanager0] $BOT_HOME 없음 — bot account 미초기화. skip."
  exit 0
fi

link_resource() {
  local name="$1"
  local src="$REUS_HOME/$name"
  local dst="$BOT_HOME/$name"

  if [ ! -e "$src" ]; then
    echo "[sync-snamanager0] source missing: $src — skip $name"
    return 0
  fi

  if [ -L "$dst" ]; then
    local current
    current="$(readlink "$dst")"
    if [ "$current" = "$src" ]; then
      echo "[sync-snamanager0] $name → $src (already linked)"
      return 0
    fi
    echo "[sync-snamanager0] $name → fixing stale link ($current → $src)"
    rm "$dst"
  elif [ -e "$dst" ]; then
    local backup="${dst}.bak.$(date +%Y%m%d-%H%M%S)"
    echo "[sync-snamanager0] $name → real path exists, backing up to $backup"
    mv "$dst" "$backup"
  fi

  ln -s "$src" "$dst"
  echo "[sync-snamanager0] $name → linked $dst → $src"
}

link_resource agents
link_resource skills

echo "[sync-snamanager0] done."
