#!/bin/bash
# label-transition.sh — GitHub 이슈 라벨 상태 전환 (상호배타 원칙 적용)
#
# 용도: 봇들이 이슈 상태 전환 시 호출하는 공용 스크립트
#       상호배타 그룹 내 라벨이 항상 1개만 존재하도록 보장
#
# 사용법:
#   label-transition.sh <이슈번호> <새 라벨>
#   label-transition.sh 42 bot:in-progress
#   label-transition.sh 42 bot:done
#
# 환경변수:
#   GH_REPO  — 대상 레포 (기본: 현재 gh 기본 레포)

set -uo pipefail

ISSUE="$1"
NEW_LABEL="$2"

# 상호배타 상태 라벨 그룹
BOT_STATE_LABELS=(
  "bot:needs-spec"
  "bot:spec-ready"
  "bot:in-progress"
  "bot:needs-review"
  "bot:request-changes"
  "bot:done"
  "bot:blocked"
)

log() { echo "[$(date '+%H:%M:%S')] label-transition: $*"; }

if [ -z "$ISSUE" ] || [ -z "$NEW_LABEL" ]; then
  echo "사용법: $0 <이슈번호> <새_라벨>"
  exit 1
fi

if ! command -v gh &>/dev/null; then
  log "ERROR: gh CLI 없음"
  exit 1
fi

# 현재 이슈 라벨 조회
CURRENT_LABELS=$(gh issue view "$ISSUE" --json labels --jq '[.labels[].name]' 2>/dev/null || echo "[]")

# 제거할 상태 라벨 목록 구성
REMOVE_ARGS=()
for label in "${BOT_STATE_LABELS[@]}"; do
  if echo "$CURRENT_LABELS" | python3 -c "import json,sys; labels=json.load(sys.stdin); exit(0 if '$label' in labels else 1)" 2>/dev/null; then
    if [ "$label" != "$NEW_LABEL" ]; then
      REMOVE_ARGS+=("--remove-label" "$label")
      log "제거 예정: $label"
    fi
  fi
done

# 라벨 전환 실행
if [ ${#REMOVE_ARGS[@]} -gt 0 ]; then
  gh issue edit "$ISSUE" "${REMOVE_ARGS[@]}" --add-label "$NEW_LABEL"
else
  gh issue edit "$ISSUE" --add-label "$NEW_LABEL"
fi

log "이슈 #$ISSUE → $NEW_LABEL 전환 완료"
