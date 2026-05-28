#!/usr/bin/env bash
# P2-F (2026-05-28): OpenClaw 7봇의 Slack manifest 에서 app_mention bot_event 제거.
#
# 목적: Semi/Colony 만 사용자 가시. OpenClaw 7봇(@SemiClaw 등) 직접 멘션 차단.
# 봇 user 와 outbox 게시 권한은 보존 (SEMO_REPLY_WRAP_PERSONA 와 호환).
#
# 사용:
#   ./scripts/openclaw-bots-disable-app-mention.sh             # 7봇 일괄
#   ./scripts/openclaw-bots-disable-app-mention.sh dry-run     # 미실행, 변경 미리보기
#   ./scripts/openclaw-bots-disable-app-mention.sh restore     # app_mention 복원
#
# 사전: ~/.claude/semo/.env 의 SLACK_APP_CONFIG_TOKEN 유효 (없으면 refresh 시도)
#
# KB: semo decision/pluggable-persistence-implementation-2026-05-28 의 P2-F

set -euo pipefail
ENV_FILE="${ENV_FILE:-$HOME/.claude/semo/.env}"
ACTION="${1:-apply}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ env 파일 없음: $ENV_FILE" >&2
  exit 1
fi

# P3-C (2026-05-28): 7봇별 App ID 를 KB identity 메타에서 동적 조회.
# 박제는 scripts/seed-bot-slack-app-ids.sh 로 선행해야 함.
BOT_NAMES=(semiclaw planclaw workclaw reviewclaw designclaw infraclaw growthclaw)
declare -a BOT_APP_IDS=()
for bot in "${BOT_NAMES[@]}"; do
  app_id=$(semo kb get "$bot" identity 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    md = d.get('metadata') or {}
    aid = md.get('slack_app_id', '')
    print(aid if aid else '')
except Exception:
    print('')
" 2>/dev/null || echo "")
  if [[ -n "$app_id" ]]; then
    BOT_APP_IDS+=("$bot:$app_id")
  fi
done

if [[ ${#BOT_APP_IDS[@]} -eq 0 ]]; then
  cat <<'EOF' >&2
⚠ KB 에 박제된 봇 slack_app_id 가 0개입니다.

박제 절차:
  1) ./scripts/seed-bot-slack-app-ids.sh interactive
     (각 봇별 Slack App ID 입력 — A0XXX... 형식)
  2) ./scripts/seed-bot-slack-app-ids.sh show 로 박제 상태 확인
  3) 본 스크립트 재실행

또는 Slack admin UI 에서 수동 처리 가능:
  https://api.slack.com/apps → 각 봇 → Event Subscriptions → app_mention uncheck
EOF
  exit 0
fi

echo "── KB 박제 봇 감지: ${#BOT_APP_IDS[@]}개 ──"
for entry in "${BOT_APP_IDS[@]}"; do echo "  $entry"; done

source "$ENV_FILE"
CONFIG_TOKEN="${SLACK_APP_CONFIG_TOKEN:-}"
if [[ -z "$CONFIG_TOKEN" ]]; then
  echo "✗ SLACK_APP_CONFIG_TOKEN 미설정. semo CLI 가 refresh 자동화 필요." >&2
  exit 1
fi

apply_manifest_change() {
  local bot_id="$1" app_id="$2" mode="$3"
  echo "── [$bot_id] app_id=$app_id mode=$mode ──"

  # 1) 현재 manifest export
  local export_resp manifest
  export_resp=$(curl -sS -X POST \
    -H "Authorization: Bearer $CONFIG_TOKEN" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "app_id=$app_id" \
    "https://slack.com/api/apps.manifest.export")

  if ! echo "$export_resp" | grep -q '"ok":true'; then
    echo "  ✗ export 실패: $(echo "$export_resp" | head -c 200)"
    return 1
  fi
  manifest=$(echo "$export_resp" | python3 -c "
import sys, json
d = json.load(sys.stdin)
m = d['manifest']
events = m.setdefault('settings',{}).setdefault('event_subscriptions',{}).setdefault('bot_events',[])
mode = '$mode'
if mode == 'disable':
    events = [e for e in events if e != 'app_mention']
elif mode == 'restore':
    if 'app_mention' not in events:
        events.append('app_mention')
m['settings']['event_subscriptions']['bot_events'] = events
print(json.dumps(m, ensure_ascii=False))
")

  if [[ "$ACTION" == "dry-run" ]]; then
    echo "  (dry-run) 변경될 manifest bot_events:"
    echo "$manifest" | python3 -c "import sys,json; print('   ', json.load(sys.stdin)['settings']['event_subscriptions']['bot_events'])"
    return 0
  fi

  # 2) update 호출
  local update_resp
  update_resp=$(curl -sS -X POST \
    -H "Authorization: Bearer $CONFIG_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$(jq -nc --arg app_id "$app_id" --argjson m "$manifest" '{app_id:$app_id, manifest:($m | tojson)}')" \
    "https://slack.com/api/apps.manifest.update")

  if echo "$update_resp" | grep -q '"ok":true'; then
    echo "  ✓ manifest 갱신 완료"
  else
    echo "  ✗ update 실패: $(echo "$update_resp" | head -c 300)"
  fi
}

case "$ACTION" in
  apply|dry-run)
    target_mode="disable"
    ;;
  restore)
    target_mode="restore"
    ;;
  *)
    echo "사용: $0 [apply|dry-run|restore]" >&2
    exit 2
    ;;
esac

for entry in "${BOT_APP_IDS[@]}"; do
  IFS=':' read -r bot_id app_id <<<"$entry"
  apply_manifest_change "$bot_id" "$app_id" "$target_mode" || true
done

echo
echo "완료. 다음 단계:"
echo "  - Slack workspace 에서 @<botname> 멘션 시 응답 X 확인"
echo "  - 봇은 여전히 outbox 게시 가능 (SEMO_REPLY_WRAP_PERSONA=1 와 호환)"
echo "  - 롤백: $0 restore"
