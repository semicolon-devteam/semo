#!/bin/bash
# create-pr.sh — GitHub PR 생성 자동화
#
# 용도: WorkClaw가 작업 완료 후 PR을 생성하고 이슈 라벨을 전환
#       에이전트 없이 bash로 처리 (판단 불필요한 루틴 작업)
#
# 사용법:
#   create-pr.sh <이슈번호> <PR제목> [base브랜치]
#   create-pr.sh 42 "feat: 로그인 기능 구현" dev
#
# 환경변수:
#   GH_REPO  — 대상 레포 (기본: 현재 gh 기본 레포)

set -uo pipefail

ISSUE="${1:-}"
PR_TITLE="${2:-}"
BASE="${3:-dev}"

log() { echo "[$(date '+%H:%M:%S')] create-pr: $*"; }

if [ -z "$ISSUE" ] || [ -z "$PR_TITLE" ]; then
  echo "사용법: $0 <이슈번호> <PR제목> [base브랜치]"
  exit 1
fi

if ! command -v gh &>/dev/null; then
  log "ERROR: gh CLI 없음"
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
log "현재 브랜치: $CURRENT_BRANCH → base: $BASE"

# PR 생성
PR_URL=$(gh pr create \
  --title "$PR_TITLE" \
  --body "$(cat <<EOF
## 관련 이슈

Closes #${ISSUE}

## 변경 요약

이슈 #${ISSUE}의 AC 기준에 따라 구현 완료.

## 체크리스트

- [ ] TypeScript 타입 에러 0
- [ ] ESLint 통과
- [ ] 빌드 성공
- [ ] AC 항목 자가 검증 완료

> 🤖 WorkClaw가 생성한 PR. ReviewClaw 리뷰 후 Reus 승인 필요.
EOF
)" \
  --base "$BASE" \
  --head "$CURRENT_BRANCH" 2>&1)

if echo "$PR_URL" | grep -q "https://"; then
  PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
  log "PR 생성 완료: $PR_URL"

  # 이슈 라벨 전환: bot:in-progress → bot:needs-review
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ -f "$SCRIPT_DIR/label-transition.sh" ]; then
    bash "$SCRIPT_DIR/label-transition.sh" "$ISSUE" "bot:needs-review"
  else
    gh issue edit "$ISSUE" --remove-label "bot:in-progress" --add-label "bot:needs-review"
  fi

  log "이슈 #$ISSUE: bot:in-progress → bot:needs-review"
  echo "PR: $PR_URL"
else
  log "ERROR: PR 생성 실패"
  echo "$PR_URL"
  exit 1
fi
