#!/usr/bin/env bash
# create-and-route.sh — GitHub 이슈 생성 + 라벨 라우팅 파이프라인
#
# Usage:
#   ./create-and-route.sh <repo> <title> <label> [body]
#
# Args:
#   repo   — GitHub repo (e.g. semicolon-devteam/semo)
#   title  — 이슈 제목
#   label  — bot:* 라벨 (bot:needs-spec | bot:spec-ready | bot:needs-review | bot:blocked)
#   body   — 이슈 본문 (선택, 기본값: 빈 문자열)
#
# Examples:
#   ./create-and-route.sh semicolon-devteam/semo "버그: 로그인 오류" bot:spec-ready "재현 방법: ..."
#   ./create-and-route.sh semicolon-devteam/semo "신규 기능: 대시보드 차트" bot:needs-spec

set -euo pipefail

REPO="${1:-}"
TITLE="${2:-}"
LABEL="${3:-}"
BODY="${4:-}"

VALID_LABELS="bot:needs-spec bot:spec-ready bot:needs-review bot:blocked bot:done"

# ── 인자 검증 ─────────────────────────────────────────────────
if [[ -z "$REPO" || -z "$TITLE" || -z "$LABEL" ]]; then
  echo "Usage: $0 <repo> <title> <label> [body]" >&2
  echo "Labels: $VALID_LABELS" >&2
  exit 1
fi

if ! echo "$VALID_LABELS" | grep -qw "$LABEL"; then
  echo "❌ 유효하지 않은 라벨: $LABEL" >&2
  echo "   허용: $VALID_LABELS" >&2
  exit 1
fi

# ── Step 0: 중복 확인 ─────────────────────────────────────────
echo "🔍 Step 0: 중복 이슈/PR 확인 중..."
KEYWORDS=$(echo "$TITLE" | tr ' ' '+' | head -c 60)
DUPES=$(gh issue list --repo "$REPO" --search "$TITLE" --state all --limit 5 --json number,title,state 2>/dev/null || echo "[]")
DUPE_COUNT=$(echo "$DUPES" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

if [[ "$DUPE_COUNT" -gt 0 ]]; then
  echo "⚠️  유사 이슈 ${DUPE_COUNT}건 발견:"
  echo "$DUPES" | python3 -c "
import json, sys
for i in json.load(sys.stdin):
    print(f\"  #{i['number']} [{i['state']}] {i['title']}\")
"
  echo ""
  read -r -p "그래도 계속 생성할까요? (y/N): " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "취소됨."
    exit 0
  fi
fi

# ── Step 1: 이슈 생성 ─────────────────────────────────────────
echo ""
echo "📝 Step 1: 이슈 생성 중..."
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  --label "$LABEL" \
  2>&1)

if [[ $? -ne 0 ]]; then
  echo "❌ 이슈 생성 실패: $ISSUE_URL" >&2
  exit 1
fi

ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
echo "✅ 이슈 생성: $ISSUE_URL"

# ── Step 2: Projects 보드 등록 ────────────────────────────────
echo ""
echo "📋 Step 2: Projects 보드 등록 중..."
PROJECT_RESULT=$(gh project item-add 1 \
  --owner semicolon-devteam \
  --url "$ISSUE_URL" 2>&1)

if [[ $? -eq 0 ]]; then
  echo "✅ Projects 보드 등록 완료"
else
  echo "⚠️  Projects 보드 등록 실패 (수동 등록 필요): $PROJECT_RESULT"
fi

# ── Step 3: 라벨 할당 확인 ────────────────────────────────────
echo ""
echo "🏷️  Step 3: 라벨 '$LABEL' 확인 중..."
APPLIED=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json labels \
  | python3 -c "import json,sys; labels=[l['name'] for l in json.load(sys.stdin)['labels']]; print(' '.join(labels))" 2>/dev/null)

if echo "$APPLIED" | grep -qw "$LABEL"; then
  echo "✅ 라벨 적용 확인: $APPLIED"
else
  echo "❌ 라벨 미적용, 수동 추가 필요"
fi

# ── 완료 요약 ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 파이프라인 완료"
echo "   이슈: $ISSUE_URL"
echo "   라벨: $LABEL"
echo ""
case "$LABEL" in
  "bot:needs-spec")  echo "   → PlanClaw가 10분 내 감지 예정" ;;
  "bot:spec-ready")  echo "   → WorkClaw가 30분 내 감지 예정" ;;
  "bot:needs-review") echo "   → ReviewClaw가 30분 내 감지 예정" ;;
  "bot:blocked")     echo "   → SemiClaw가 15분 내 감지 예정" ;;
esac
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
