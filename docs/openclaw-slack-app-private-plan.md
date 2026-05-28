# [B] OpenClaw 7봇 Slack App 비공개 처리 — One Agent Experience

## 목표

사용자가 Slack 에서 **`@Semi` / `@Colony` 만 멘션** 가능. OpenClaw 7봇 (`@SemiClaw`, `@PlanClaw`, `@ReviewClaw`, `@WorkClaw`, `@DesignClaw`, `@InfraClaw`, `@GrowthClaw`) 직접 멘션은 차단.

## 영향 (의사결정 전 검토)

- ✅ Semi 라우팅 흐름이 단일 entry-point 로 단순화
- ⚠️ 기존 `@SemiClaw` 등 직접 멘션 사용자가 적응 필요
- ⚠️ KB skill 트리거 (`[Route: planclaw]` 태그 등) 와 cron 직접 dispatch 는 코드로 이뤄지므로 영향 없음
- ✅ Slack 채널 노이즈 감소

## 절차 (Slack Admin / Workspace Owner 필요)

### 옵션 1: App 비활성화 (가장 깔끔)

각 OpenClaw 봇 App 에 대해:

1. https://api.slack.com/apps → 봇 App 선택
2. **Settings → Manage Distribution** → "Remove from Workspace"
3. 또는 App 자체 삭제 (Settings → Delete App)

→ Bot user 가 workspace 에서 사라짐. 멘션 불가.

**리스크**: 기존 slack-router 가 `*_SLACK_BOT_TOKEN` env 로 outbox 게시 시 봇 페르소나 사용 → bot user 없으면 게시 실패. SEMO_REPLY_WRAP_PERSONA=1 (이미 켜짐) 이 모든 outbox 를 Semi 명의로 wrap 하므로 OK.

### 옵션 2: 멤버 채널에서 제거만 (덜 침습적)

1. 각 OpenClaw bot user 가 join 한 모든 채널에서 kick (`/kick @SemiClaw`)
2. workspace 에서는 봇 user 존재하지만 어느 채널에서도 멘션 불가
3. bot user 는 그대로 살아있어 outbox 게시 가능 — 단 채널 멤버 아니므로 chat:write.public 권한 필요

→ slack-router 의 봇 페르소나는 그대로 사용 가능. wrapping 옵션 toggle 가능.

### 옵션 3: Manifest 의 `bot_events` 에서 `app_mention` 제거 (가장 안전)

각 OpenClaw 봇의 manifest:

```json
"event_subscriptions": {
  "bot_events": [
    // "app_mention",   ← 제거
    "message.channels",
    ...
  ]
}
```

→ Bot user 는 존재하나 @멘션 이벤트 받지 않음. 사실상 멘션 불가 (Slack UI 에 user 가 안 뜨지는 않지만 메시지 처리 X)

API 자동화 가능:

```bash
# 각 봇에 대해
curl -X POST \
  -H "Authorization: Bearer $SLACK_APP_CONFIG_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "app_id=<APP_ID>&manifest=<JSON_WITH_APP_MENTION_REMOVED>" \
  https://slack.com/api/apps.manifest.update
```

## 권장: 옵션 3 (보수적) + SEMO_REPLY_WRAP_PERSONA=1 (이미 적용)

이유:

- 봇 user persona 보존 — 기존 코드 호환
- @멘션만 차단 — Slack admin 패널에서 직접 확인 가능
- 코드 변경 0 (env 만 toggle)
- 롤백 1단계 (manifest 복구)

## 봇별 App ID (manifest update 시 필요)

```bash
semo kb get semo bot-ids 2>&1 | python3 -c "..."
# 각 봇의 slack_app_id 가 metadata 에 있는지 확인 필요
# 없으면 Slack admin UI 에서 수동 확인
```

(현재 KB 의 bot-ids 에 OpenClaw 봇별 slack_app_id 가 명시되어 있지 않음 — 추가 박제 필요)

## 실행 시점

- Semi 라우팅 + Colony Agent Factory 검증 완료 후 (현재 진행 중)
- 일주일 정도 Semi 단독 운영 안정성 관찰 후
- 사용자 (Reus) 의사결정 시점에 일괄 진행

## 본 작업이 **차단되는** 시나리오

- semiclaw 가 `[Route: planclaw]` 태그 기반 직접 mailbox 라우팅 사용 중 → 이건 변경 영향 없음 (멘션 이벤트와 무관)
- Cron job 이 봇 멘션 텍스트로 트리거 → 영향 없음 (cron 은 inbox/scheduler 기반)
- 사용자가 일부 워크플로우에서 직접 `@SemiClaw` 멘션을 의도적으로 사용 → 그 워크플로우는 `@Semi` 로 이전 필요

## KB 박제 시점

실제 적용 시 `semo decision/openclaw-slack-app-private-{date}` 키로 박제.

---

## P2-F (2026-05-28) — 자동화 스크립트 추가

`scripts/openclaw-bots-disable-app-mention.sh`:

- 7봇 manifest 의 `bot_events` 에서 `app_mention` 일괄 제거
- `apply` / `dry-run` / `restore` 3가지 모드
- 사전: `~/.claude/semo/.env` 의 `SLACK_APP_CONFIG_TOKEN` 유효 + `BOT_APP_IDS` 배열에 7봇 app_id 채워야 함 (KB 박제 후 동적 조회로 진화 가능)

### KB 박제 권장 (선행 작업)

각 OpenClaw 봇 identity 메타에 `slack_app_id` 추가:

```bash
semo kb upsert semiclaw identity --metadata '{"slack_app_id":"A0XXXXXXXXX"}'
semo kb upsert planclaw identity --metadata '{"slack_app_id":"A0XXXXXXXXX"}'
# ... 7개 봇 반복
```

박제 후 `scripts/openclaw-bots-disable-app-mention.sh` 가 `semo kb get` 으로 자동 조회하도록 update 가능.

### 안전성

- SEMO_REPLY_WRAP_PERSONA=1 (이미 활성) 와 호환 — 봇 outbox 게시는 Semi 페르소나로 wrap 됨
- `app_mention` 만 제거. 봇 user / write 권한은 보존 → 코드 변경 0
- restore 1줄로 즉시 롤백
