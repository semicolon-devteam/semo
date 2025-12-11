# Slack 설정

> SEMO 패키지에서 공통으로 참조하는 Slack 설정 정보

## Bot Token

> 🔴 **토큰 갱신 시 이 파일만 수정하면 됩니다.**

```text
SLACK_BOT_TOKEN=xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7
```

## 채널 정보

| 채널 | ID | 용도 |
|------|-----|------|
| #_협업 | C09KNL91QBZ | 기본 알림 채널 |
| #개발사업팀 | - | Fallback 채널 |

## 권한 (Scopes)

| Scope | 용도 |
|-------|------|
| `chat:write` | 메시지 전송 |
| `chat:write.public` | 공개 채널 메시지 전송 |
| `users:read` | 사용자 ID 조회 (멘션용) |

## 앱 정보

| 항목 | 값 |
|------|-----|
| **App Name** | Semicolon Notifier |
| **Workspace** | Semicolon |

## 사용 방법

### Skill/Command에서 참조

```markdown
## Slack Bot Token

> 📖 [semo-core/_shared/slack-config.md](../../semo-core/_shared/slack-config.md) 참조
```

### curl 명령어 템플릿

```bash
# 이 파일에서 토큰 읽기 (실제 스크립트용)
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7"

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "메시지 내용"
  }'
```

## 토큰 갱신 절차

1. Slack App 설정에서 새 토큰 생성
2. **이 파일의 Bot Token만 업데이트**
3. semo-core 버저닝 (PATCH)
4. `.claude/semo-core/` 동기화

> 💡 다른 파일에서는 이 파일을 참조하므로, 토큰 갱신 시 이 파일만 수정하면 됩니다.

## 토큰 테스트

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7"

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "🧪 SEMO Slack 연동 테스트"
  }'
```

## Related

- [팀원 정보 (GitHub ↔ Slack 매핑)](team-members.md)
- [notify-slack Skill](../skills/notify-slack/SKILL.md)
- [채널 설정](../skills/notify-slack/references/channel-config.md)
