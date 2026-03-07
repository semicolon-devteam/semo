#!/bin/bash
set -euo pipefail

# axoracle 피드백 일일 추출 스크립트 (GrowthClaw)
# 매일 08:50 KST 실행 → 전날 피드백 데이터 추출 → #proj-axoracle 리포팅

SUPABASE_URL="https://nmawdwgrjgocyxecrsbx.supabase.co"
SUPABASE_KEY="${AXORACLE_SUPABASE_SERVICE_KEY:-}"
SLACK_CHANNEL="C0AE4N0LSKV"  # #proj-axoracle

if [ -z "$SUPABASE_KEY" ]; then
  echo "Error: AXORACLE_SUPABASE_SERVICE_KEY 환경변수가 설정되지 않았습니다."
  exit 1
fi

# 전날 날짜 계산 (KST 기준)
YESTERDAY_KST=$(TZ=Asia/Seoul date -v-1d +%Y-%m-%d)

# UTC 변환: 전날 15:00 ~ 당일 15:00
START_UTC="${YESTERDAY_KST}T15:00:00Z"
END_UTC=$(TZ=Asia/Seoul date +%Y-%m-%d)T15:00:00Z

# Supabase REST API 호출
RESPONSE=$(curl -s -G "${SUPABASE_URL}/rest/v1/feedback" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  --data-urlencode "select=*" \
  --data-urlencode "created_at=gte.${START_UTC}" \
  --data-urlencode "created_at=lt.${END_UTC}" \
  --data-urlencode "order=created_at.asc")

# 응답 파싱
COUNT=$(echo "$RESPONSE" | jq '. | length')

# 결과 메시지 생성
if [ "$COUNT" -eq 0 ]; then
  MESSAGE="📊 **axoracle 피드백 리포트** (${YESTERDAY_KST})

전날 피드백 0건"
else
  MESSAGE="📊 **axoracle 피드백 리포트** (${YESTERDAY_KST})

**총 ${COUNT}건**

\`\`\`json
${RESPONSE}
\`\`\`"
fi

# Slack 포스팅 (OpenClaw message 도구 사용)
# 실제 실행은 크론잡 컨텍스트에서 OpenClaw CLI를 통해 수행됨
echo "$MESSAGE"

exit 0
