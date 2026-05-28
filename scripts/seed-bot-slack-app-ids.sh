#!/usr/bin/env bash
# P3-C (2026-05-28): 7봇별 Slack App ID 를 KB identity 메타에 박제.
#
# 사용:
#   # 1. 사용자가 봇별 App ID 입력 (인터랙티브)
#   ./scripts/seed-bot-slack-app-ids.sh interactive
#
#   # 2. 한 줄로 박제
#   ./scripts/seed-bot-slack-app-ids.sh set semiclaw A0XXXXXXXXX
#
#   # 3. 현재 박제 상태 조회
#   ./scripts/seed-bot-slack-app-ids.sh show
#
# 박제 후: scripts/openclaw-bots-disable-app-mention.sh 가 KB 에서 자동 조회 가능.
#
# KB: semo decision/semo-p2-complete-2026-05-28 의 P3-C

set -euo pipefail
ACTION="${1:-}"

BOTS=(semiclaw planclaw workclaw reviewclaw designclaw infraclaw growthclaw)

seed_one() {
  local bot="$1" app_id="$2"
  if [[ -z "$app_id" || ! "$app_id" =~ ^A0[A-Z0-9]+$ ]]; then
    echo "  ⚠ $bot: app_id 형식 이상 (A0... 시작 영문/숫자) — 건너뜀"
    return 0
  fi
  # 기존 identity 가져오고 metadata 에 slack_app_id 머지.
  local existing_meta
  existing_meta=$(semo kb get "$bot" identity 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    md = d.get('metadata') or {}
    md['slack_app_id'] = '$app_id'
    print(json.dumps(md, ensure_ascii=False))
except Exception:
    print('{\"slack_app_id\":\"$app_id\"}')
" 2>/dev/null || echo "{\"slack_app_id\":\"$app_id\"}")

  semo kb upsert "$bot" identity --metadata "$existing_meta" 2>&1 | grep -E "완료|에러|err" | head -1
  echo "  ✓ $bot ← slack_app_id=$app_id"
}

show_one() {
  local bot="$1"
  local meta_app_id
  meta_app_id=$(semo kb get "$bot" identity 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    md = d.get('metadata') or {}
    print(md.get('slack_app_id', '(미박제)'))
except Exception:
    print('(조회 실패)')
" 2>/dev/null)
  printf '  %-12s %s\n' "$bot" "$meta_app_id"
}

case "$ACTION" in
  interactive)
    echo "── 7봇별 slack_app_id 입력 (Enter 로 skip) ──"
    for bot in "${BOTS[@]}"; do
      cur=$(semo kb get "$bot" identity 2>/dev/null | python3 -c "import sys,json; print((json.load(sys.stdin).get('metadata') or {}).get('slack_app_id',''))" 2>/dev/null || echo "")
      read -r -p "  $bot (현재: ${cur:-없음}) > " app_id
      [[ -z "$app_id" ]] && continue
      seed_one "$bot" "$app_id"
    done
    ;;
  set)
    bot="${2:-}"
    app_id="${3:-}"
    [[ -z "$bot" || -z "$app_id" ]] && { echo "사용: $0 set <bot> <A0XXX...>" >&2; exit 2; }
    seed_one "$bot" "$app_id"
    ;;
  show)
    echo "── 7봇 slack_app_id KB 박제 상태 ──"
    for bot in "${BOTS[@]}"; do show_one "$bot"; done
    ;;
  *)
    cat <<EOF >&2
P3-C — OpenClaw 7봇 Slack App ID KB 박제 helper

사용:
  $0 interactive       # 각 봇별 입력 (Enter 로 skip)
  $0 set <bot> <id>    # 개별 박제 (예: $0 set semiclaw A0XX...)
  $0 show              # 현재 박제 상태 조회

박제 후 scripts/openclaw-bots-disable-app-mention.sh 가 KB 에서 자동 조회.
EOF
    exit 2
    ;;
esac
