# Channel Configuration

> Slack 알림 대상 채널 설정 및 권한 관리

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
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

# 채널 목록 조회
curl -X GET "https://slack.com/api/conversations.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" | jq '.channels[] | {id, name}'
```

## 앱 권한 설정

### 필수 Bot Token Scopes

| Scope | 용도 |
|-------|------|
| `chat:write` | 메시지 전송 |
| `chat:write.public` | 가입하지 않은 공개 채널에 메시지 전송 |
| `users:read` | 사용자 ID 조회 (멘션용) |

### 앱을 채널에 추가

앱이 비공개 채널에 메시지를 보내려면 해당 채널에 앱을 추가해야 합니다:

1. Slack에서 해당 채널 열기
2. 채널 이름 클릭 → 설정
3. "앱 추가" 클릭
4. "Semicolon Notifier" 검색 후 추가

## 채널 선택 로직

```text
1. draft-task-creator에서 Epic의 프로젝트 확인
2. 프로젝트별 채널 매핑 확인 (미구현 - 기본값 사용)
3. 기본 채널: #_협업
4. 권한 오류 시: #개발사업팀으로 fallback
```

### 프로젝트별 채널 매핑 (향후 확장)

```yaml
# 향후 프로젝트별 채널 분리 시 사용
project_channels:
  오피스: "#dev-office"
  소개: "#dev-introduction"
  default: "#_협업"
```

## 권한 오류 대응

### `not_in_channel` 오류

```bash
# 오류 메시지
{"ok": false, "error": "not_in_channel"}

# 해결: 앱을 채널에 추가
```

### `channel_not_found` 오류

```bash
# 오류 메시지
{"ok": false, "error": "channel_not_found"}

# 해결: 채널 ID 또는 이름 확인
```

### `missing_scope` 오류

```bash
# 오류 메시지
{"ok": false, "error": "missing_scope", "needed": "chat:write"}

# 해결: 앱 설정에서 OAuth Scopes 추가
# https://api.slack.com/apps/{app_id}/oauth
```

## 테스트 명령

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

# 테스트 메시지 전송
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#_협업",
    "text": "🧪 SAX notify-slack Skill 테스트 메시지입니다."
  }'
```

## 참고

- Slack API 문서: https://api.slack.com/methods/chat.postMessage
- Block Kit Builder: https://app.slack.com/block-kit-builder
