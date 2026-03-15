#!/bin/bash
# bot-ops 브로드캐스트 헬퍼
# 사용법: broadcast-bots.sh "메시지 내용"
# 자동으로 모든 봇 멘션을 추가합니다.

MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
  echo "❌ 사용법: broadcast-bots.sh \"메시지 내용\""
  exit 1
fi

# 봇 ID 목록 (SemiClaw 자신 제외)
BOTS=(
  "<@U0AFECSJHK3>"  # WorkClaw
  "<@U0AFNMGKURX>"  # PlanClaw
  "<@U0AF1RK0E67>"  # ReviewClaw
  "<@U0AFC0MK2TY>"  # DesignClaw
  "<@U0AFALA3EF7>"  # GrowthClaw
  "<@U0AFPDMCGHX>"  # InfraClaw
)

MENTIONS="${BOTS[*]}"

echo "📢 메시지:"
echo "$MESSAGE"
echo ""
echo "✅ 멘션 포함: $MENTIONS"
echo ""
echo "=== 최종 메시지 ==="
echo "${MESSAGE}

${MENTIONS}"
