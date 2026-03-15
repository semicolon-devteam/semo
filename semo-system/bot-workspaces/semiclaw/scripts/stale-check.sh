#!/bin/bash
# stale-check.sh — Dead-letter 감지: 24h 이상 bot:in-progress 이슈 자동 에스컬레이션
#
# 용도: SemiClaw 헬스비트(15분 주기)에서 호출
# 동작:
#   1. bot:in-progress 라벨이 24h 이상인 이슈 감지
#   2. bot:blocked 라벨 추가
#   3. Slack #bot-ops 알림
#
# 환경변수:
#   GITHUB_TOKEN    — gh CLI 인증 (기본적으로 gh auth로 설정됨)
#   SLACK_WEBHOOK   — bot-ops 채널 Webhook URL (선택)
#   STALE_HOURS     — 스탤 기준 시간 (기본: 24)

set -euo pipefail

STALE_HOURS="${STALE_HOURS:-24}"
STALE_SECONDS=$((STALE_HOURS * 3600))
NOW=$(date +%s)
ESCALATED=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] stale-check: $*"; }

log "스탤 이슈 감지 시작 (기준: ${STALE_HOURS}h)"

# gh CLI 확인
if ! command -v gh &>/dev/null; then
  log "ERROR: gh CLI 없음"
  exit 1
fi

# bot:in-progress 이슈 목록 (업데이트 시간 포함)
ISSUES=$(gh issue list \
  --label "bot:in-progress" \
  --state open \
  --json number,title,updatedAt,labels \
  --limit 100 2>/dev/null || echo "[]")

if [ "$ISSUES" = "[]" ] || [ -z "$ISSUES" ]; then
  log "스탤 이슈 없음"
  exit 0
fi

# 각 이슈 처리
echo "$ISSUES" | python3 - << PYEOF
import json, sys, subprocess, os
from datetime import datetime, timezone

issues = json.load(sys.stdin) if sys.stdin.isatty() == False else []
issues = json.loads("""$ISSUES""")
now = datetime.now(timezone.utc)
stale_seconds = $STALE_SECONDS

for issue in issues:
    number = issue['number']
    title = issue['title']
    updated_str = issue['updatedAt']

    # 업데이트 시간 파싱
    updated = datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
    age_seconds = (now - updated).total_seconds()

    # 이미 bot:blocked인지 확인
    labels = [l['name'] for l in issue.get('labels', [])]
    if 'bot:blocked' in labels:
        continue  # 이미 에스컬레이션됨

    if age_seconds >= stale_seconds:
        age_hours = int(age_seconds / 3600)
        print(f"[스탤 감지] #{number}: {title} ({age_hours}h 경과)")

        # bot:blocked 라벨 추가
        try:
            subprocess.run(
                ['gh', 'issue', 'edit', str(number), '--add-label', 'bot:blocked'],
                check=True, capture_output=True
            )
            print(f"  → bot:blocked 라벨 추가됨")
        except subprocess.CalledProcessError as e:
            print(f"  → 라벨 추가 실패: {e}")
            continue

        # 이슈 코멘트 추가
        comment = f"""⚠️ **[Dead-Letter 감지]** 이 이슈가 `bot:in-progress` 상태로 {age_hours}시간이 경과했습니다.

자동으로 `bot:blocked`로 전환되었습니다. SemiClaw(<@U0ADGB42N79>)가 검토 예정입니다.

- 담당 봇이 확인 후 재개 가능: `bot:blocked` 제거 → `bot:in-progress` 재부착
- 사람 판단 필요 시 Reus에게 에스컬레이션"""

        try:
            subprocess.run(
                ['gh', 'issue', 'comment', str(number), '--body', comment],
                check=True, capture_output=True
            )
        except subprocess.CalledProcessError:
            pass

        # Slack 알림 (SLACK_WEBHOOK 설정된 경우)
        webhook = os.environ.get('SLACK_WEBHOOK', '')
        if webhook:
            import urllib.request
            slack_msg = json.dumps({
                "text": f"⚠️ *[Dead-Letter]* 이슈 #{number}: {title}\n{age_hours}h 이상 `bot:in-progress` → `bot:blocked` 전환\n담당봇 확인 요청"
            })
            try:
                req = urllib.request.Request(
                    webhook,
                    data=slack_msg.encode(),
                    headers={'Content-Type': 'application/json'}
                )
                urllib.request.urlopen(req, timeout=5)
                print(f"  → Slack 알림 전송됨")
            except Exception as e:
                print(f"  → Slack 알림 실패: {e}")

PYEOF

log "스탤 체크 완료"
