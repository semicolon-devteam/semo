# Slack 동적 사용자 조회 가이드

> Slack API를 통한 실시간 사용자 ID 조회 방법

## 개요

notify-slack Skill은 **하드코딩된 매핑 테이블 대신 Slack API를 통해 동적으로 사용자를 조회**합니다.

### 장점

- 신규 팀원 추가 시 별도 설정 불필요
- 표시 이름 변경 시 자동 반영
- 매핑 테이블 관리 부담 제거

## 조회 API

### users.list

전체 워크스페이스 사용자 목록 조회:

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

**응답 구조**:

```json
{
  "ok": true,
  "members": [
    {
      "id": "URSQYUNQJ",
      "name": "reus",
      "real_name": "전준영",
      "deleted": false,
      "is_bot": false,
      "profile": {
        "display_name": "Reus"
      }
    }
  ]
}
```

### users.lookupByEmail (옵션)

이메일로 특정 사용자 조회:

```bash
curl -s "https://slack.com/api/users.lookupByEmail?email=user@example.com" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

> **Note**: `users:read.email` 권한 필요

## 사용자 매칭 로직

### 매칭 우선순위

| 순위 | 필드 | 설명 |
|------|------|------|
| 1 | `profile.display_name` | Slack에 표시되는 이름 |
| 2 | `name` | Slack username |
| 3 | `real_name` | 실제 이름 (한글 가능) |

### 매칭 예시

```bash
SEARCH_NAME="Reus"

SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r --arg name "$SEARCH_NAME" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase) or
        (.real_name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)

echo "$SLACK_ID"  # URSQYUNQJ
```

### 대소문자 무시

매칭 시 대소문자를 구분하지 않습니다:

- `"reus"` → URSQYUNQJ ✅
- `"Reus"` → URSQYUNQJ ✅
- `"REUS"` → URSQYUNQJ ✅

## 멘션 형식

### 사용자 멘션

```
<@SLACK_USER_ID>
```

예시: `<@URSQYUNQJ>` → @Reus 멘션

### 채널 멘션

```
<#CHANNEL_ID>
```

## 필요 권한

| 권한 | 용도 |
|------|------|
| `users:read` | 사용자 목록 조회 (필수) |
| `users:read.email` | 이메일로 조회 (옵션) |
| `chat:write` | 메시지 전송 (필수) |

## 팀원 참조 (Semicolon)

> 아래는 API 조회 결과 기준 참조 정보입니다. 실제 멘션 시 API를 통해 동적으로 조회합니다.

| Display Name | Slack ID | Real Name |
|--------------|----------|-----------|
| Reus | URSQYUNQJ | 전준영 |
| Garden | URU4UBX9R | 서정원 |
| kyago | U02G8542V9U | 강용준 |
| Roki | U08P11ZQY04 | 노영록 |
| bon | U02V56WM3KD | 장현봉 |
| dwight.k | U06Q5KECB5J | 강동현 |
| Yeomso | U080YLC0MFZ | 염현준 |

## 조회 실패 시 처리

사용자를 찾지 못한 경우:

1. 멘션 없이 이름만 텍스트로 표시
2. 경고 메시지 출력

```markdown
⚠️ `{search_name}`에 해당하는 Slack 사용자를 찾을 수 없습니다.
```

## 트러블슈팅

### "users:read" 권한 오류

```json
{"ok": false, "error": "missing_scope"}
```

**해결**: Slack App 설정 → OAuth & Permissions → `users:read` 추가

### 빈 결과 반환

- 검색 이름 철자 확인
- 해당 사용자가 워크스페이스에 있는지 확인
- 봇/삭제된 사용자 제외 필터 확인
