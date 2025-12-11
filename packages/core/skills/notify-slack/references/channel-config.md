# Channel Configuration

> Slack 알림 대상 채널 설정 및 권한 관리

> 📖 **중앙 설정**: [semo-core/_shared/slack-config.md](../../../_shared/slack-config.md) 참조

## 대상 채널

| 채널 | 용도 | 우선순위 |
|------|------|----------|
| `#_협업` | 기본 알림 채널 | Primary |
| `#개발사업팀` | 대체 채널 | Fallback |

## 채널 ID 조회

### 방법 1: Slack에서 확인

1. 해당 채널 열기
2. 채널 이름 클릭 → 채널 세부정보
3. 하단의 "채널 ID" 복사 (C로 시작)

### 방법 2: API로 조회

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7"

curl -X GET "https://slack.com/api/conversations.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.channels[] | {id, name}'
```

## 앱 권한 설정

### 필수 Bot Token Scopes

| Scope | 용도 |
|-------|------|
| `chat:write` | 메시지 전송 |
| `chat:write.public` | 공개 채널 메시지 전송 |
| `users:read` | 사용자 ID 조회 (멘션용) |

### 앱을 채널에 추가

비공개 채널에 메시지를 보내려면:

1. Slack에서 해당 채널 열기
2. 채널 이름 클릭 → 설정
3. "앱 추가" 클릭
4. "Semicolon Notifier" 검색 후 추가

## 알림 유형별 채널

| 알림 유형 | 채널 | 비고 |
|----------|------|------|
| 릴리스 알림 | `#_협업` | SEMO 패키지 업데이트 |
| 이슈 알림 | `#_협업` | Draft Task, Issue 생성 |
| 커스텀 메시지 | 지정된 채널 | /SEMO:slack 커맨드 |

## 권한 오류 대응

### `not_in_channel` 오류

```bash
{"ok": false, "error": "not_in_channel"}
# 해결: 앱을 채널에 추가
```

### `channel_not_found` 오류

```bash
{"ok": false, "error": "channel_not_found"}
# 해결: 채널 ID 또는 이름 확인
```

### `missing_scope` 오류

```bash
{"ok": false, "error": "missing_scope", "needed": "chat:write"}
# 해결: 앱 설정에서 OAuth Scopes 추가
```

## 테스트 명령

> **⚠️ 중요**: 쉘 이스케이프 문제를 방지하기 위해 **heredoc 방식**을 사용하세요.

```bash
# ✅ 권장: heredoc 방식
curl -s -X POST 'https://slack.com/api/chat.postMessage' \
  -H 'Authorization: Bearer xoxb-891491331223-9421307124626-IytLQOaiaN2R97EMUdElgdX7' \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d @- << 'EOF'
{
  "channel": "C09KNL91QBZ",
  "text": "SEMO notify-slack 테스트 메시지"
}
EOF
```

## 참고

- Slack API 문서: https://api.slack.com/methods/chat.postMessage
- Block Kit Builder: https://app.slack.com/block-kit-builder
