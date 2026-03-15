#!/bin/bash
# bot-status-sync.sh — 전체 봇 상태를 Core DB에 동기화
#
# 용도: semo.bot_status 테이블에 모든 봇의 마지막 활동 시간 upsert
# 실행: cron 또는 LaunchAgent로 15분마다 실행 권장
#
# 크론 설정 예시:
#   */15 * * * * /path/to/semiclaw/scripts/bot-status-sync.sh >> /tmp/bot-status-sync.log 2>&1
#
# LaunchAgent 설정 예시 (~/.config/semicolon/launchagents/bot-status-sync.plist):
#   StartInterval: 900 (15분 = 900초)

set -euo pipefail

# semo-system 디렉토리 위치 (이 스크립트에서 2단계 상위)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEMO_SYSTEM_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)/semo-system"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] bot-status-sync 시작"

# semo CLI 존재 확인
if ! command -v semo &>/dev/null; then
  echo "ERROR: semo 명령어를 찾을 수 없습니다. npm install -g @team-semicolon/semo-cli 실행하세요."
  exit 1
fi

# bot-workspaces 디렉토리 확인
if [ ! -d "$SEMO_SYSTEM_DIR/bot-workspaces" ]; then
  echo "ERROR: bot-workspaces 디렉토리를 찾을 수 없습니다: $SEMO_SYSTEM_DIR/bot-workspaces"
  exit 1
fi

# semo bots sync 실행
semo bots sync --semo-system "$SEMO_SYSTEM_DIR" 2>&1
STATUS=$?

if [ $STATUS -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] bot-status-sync 완료"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] bot-status-sync 실패 (exit: $STATUS)"
  exit $STATUS
fi
