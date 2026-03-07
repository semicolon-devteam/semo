#!/bin/bash
# AXOracle feedback 테이블 전날 데이터 추출
# GrowthClaw 일일 분석 파이프라인용

SUPABASE_URL="https://nmawdwgrjgocyxecrsbx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdkd2dyamdvY3l4ZWNyc2J4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ1MjQ2NiwiZXhwIjoyMDg2MDI4NDY2fQ.hL13T3nUtwz1UI7lAmdonp47lWRFqdHw8aeWg-trSZ8"

# 어제 날짜 (KST 기준)
YESTERDAY=$(TZ=Asia/Seoul date -v-1d +%Y-%m-%d 2>/dev/null || TZ=Asia/Seoul date -d "yesterday" +%Y-%m-%d)
TODAY=$(TZ=Asia/Seoul date +%Y-%m-%d 2>/dev/null || TZ=Asia/Seoul date +%Y-%m-%d)

# UTC로 변환 (KST = UTC+9)
START="${YESTERDAY}T15:00:00Z"  # 전날 KST 00:00 = 전전날 UTC 15:00
END="${TODAY}T15:00:00Z"        # 오늘 KST 00:00 = 어제 UTC 15:00

curl -s "${SUPABASE_URL}/rest/v1/feedback?select=*&created_at=gte.${START}&created_at=lt.${END}&order=created_at.asc" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: count=exact"
