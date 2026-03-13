#!/bin/bash
# 위시캣 프로젝트 크롤링 및 Slack 전송

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_FILE="$SCRIPT_DIR/wishket-cache.json"
SLACK_CHANNEL="C0ABAE680PR"
SLACK_USER_MENTION="<@U01KH8V6ZHP>"

# Mock 데이터 (실제 크롤링 대신 사용)
MOCK_PROJECTS='[
  {
    "title": "AI 기반 헬스케어 앱 개발",
    "budget": "3000만원",
    "duration": "3개월",
    "skills": ["React Native", "TypeScript", "Node.js", "AWS", "AI"],
    "category": "헬스케어",
    "competition": 3,
    "url": "https://www.wishket.com/project/123",
    "deadline": "2026-03-10"
  },
  {
    "title": "커머스 웹사이트 리뉴얼",
    "budget": "1500만원",
    "duration": "2개월",
    "skills": ["React", "Next.js", "PostgreSQL", "Docker"],
    "category": "커머스",
    "competition": 8,
    "url": "https://www.wishket.com/project/124",
    "deadline": "2026-03-05"
  },
  {
    "title": "교육 플랫폼 백엔드 개발",
    "budget": "2000만원",
    "duration": "3개월",
    "skills": ["Kotlin", "Spring Boot", "MySQL", "Kubernetes"],
    "category": "교육",
    "competition": 5,
    "url": "https://www.wishket.com/project/125",
    "deadline": "2026-03-12"
  },
  {
    "title": "AI 챗봇 서비스 구축",
    "budget": "2500만원",
    "duration": "2.5개월",
    "skills": ["Python", "LLM", "ChatGPT", "AWS", "React"],
    "category": "AI",
    "competition": 4,
    "url": "https://www.wishket.com/project/126",
    "deadline": "2026-03-08"
  },
  {
    "title": "SaaS 관리자 대시보드",
    "budget": "1200만원",
    "duration": "2개월",
    "skills": ["Vue.js", "TypeScript", "Node.js", "PostgreSQL"],
    "category": "SaaS",
    "competition": 6,
    "url": "https://www.wishket.com/project/127",
    "deadline": "2026-03-15"
  }
]'

# 실제 크롤링 실행 (Python 스크립트)
echo "🦀 위시켓 프로젝트 크롤링 시작..."
CRAWL_OUTPUT=$(python3 "$SCRIPT_DIR/crawl.py" 2>&1)

# 크롤링 결과가 있는지 확인
if echo "$CRAWL_OUTPUT" | grep -q "❌"; then
  echo "⚠️ 크롤링 실패, Mock 데이터 사용"
  PROJECTS_JSON="$MOCK_PROJECTS"
else
  # JSON 부분만 추출 (마지막 [ ... ] 블록)
  PROJECTS_JSON=$(echo "$CRAWL_OUTPUT" | sed -n '/^\[/,/^\]/p')
  
  if [ -z "$PROJECTS_JSON" ]; then
    echo "⚠️ 크롤링 결과 파싱 실패, Mock 데이터 사용"
    PROJECTS_JSON="$MOCK_PROJECTS"
  fi
fi

# 스코어링 실행 (Node.js 스크립트)
echo "📊 스코어링 중..."
SCORED_MESSAGE=$(echo "$PROJECTS_JSON" | node "$SCRIPT_DIR/score.js")

# Slack 전송
echo "📤 Slack 전송 중..."

# OpenClaw message tool을 사용하는 경우:
# openclaw message send --target "$SLACK_CHANNEL" --message "$SLACK_USER_MENTION $SCORED_MESSAGE"

# 또는 직접 curl 사용:
if [ -n "$SLACK_BOT_TOKEN" ]; then
  # JSON 이스케이프
  ESCAPED_MESSAGE=$(echo "$SCORED_MESSAGE" | jq -Rs .)
  
  curl -s -X POST "https://slack.com/api/chat.postMessage" \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"channel\": \"$SLACK_CHANNEL\",
      \"text\": \"$SLACK_USER_MENTION\",
      \"blocks\": [
        {
          \"type\": \"section\",
          \"text\": {
            \"type\": \"mrkdwn\",
            \"text\": $ESCAPED_MESSAGE
          }
        }
      ]
    }" > /dev/null
  
  echo "✅ Slack 전송 완료"
else
  echo "⚠️ SLACK_BOT_TOKEN 환경 변수가 설정되지 않았습니다."
  echo "메시지 미리보기:"
  echo "$SCORED_MESSAGE"
fi

echo "✅ 위시켓 크롤링 완료"
