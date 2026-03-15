#!/bin/bash
# slack-notify.sh — Slack #bot-ops 알림 공용 스크립트
#
# 용도: 봇 팀 공용 Slack 알림. 에이전트 레이어 없이 webhook으로 직접 전송.
#
# 사용법:
#   slack-notify.sh <메시지>
#   slack-notify.sh ":white_check_mark: WorkClaw: 이슈 #42 작업 완료"
#   slack-notify.sh ":warning: dead-letter 감지: 이슈 #99 24h 초과"
#
# 환경변수:
#   SLACK_WEBHOOK  — Slack Incoming Webhook URL (필수)
#   SLACK_CHANNEL  — 채널 (기본: webhook 설정값 사용)

set -uo pipefail

MESSAGE="${1:-}"

if [ -z "$MESSAGE" ]; then
  echo "사용법: $0 <메시지>"
  exit 1
fi

WEBHOOK="${SLACK_WEBHOOK:-}"
if [ -z "$WEBHOOK" ]; then
  echo "[slack-notify] SLACK_WEBHOOK 미설정 — 스킵"
  exit 0
fi

PAYLOAD=$(python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({'text': msg}))
" "$MESSAGE")

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  "$WEBHOOK")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "[slack-notify] 전송 완료 (HTTP $HTTP_STATUS)"
else
  echo "[slack-notify] 전송 실패 (HTTP $HTTP_STATUS)"
  exit 1
fi
