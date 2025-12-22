---
name: notify-slack
description: |
  Slack 알림 전송. Use when (1) "슬랙에 알려줘", "알림 보내줘",
  (2) 작업 완료 알림, (3) 에러 알림.
tools: [Bash, Read]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: notify-slack` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 알림 전송 자동화

## Trigger Keywords

- "슬랙에 알려줘", "알림 보내줘"
- "팀에 공유해줘"
- "완료 알림"

---

## 🔴 Slack API 호출 방법 (curl 우선)

> **⚠️ MCP 대신 curl을 사용합니다. 토큰은 `.env` 파일에서 로드합니다.**

### 토큰 로드

```bash
# 프로젝트 루트의 .env 파일에서 토큰 읽기
SLACK_BOT_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d '=' -f2)
```

### 메시지 전송

```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "메시지 내용"
  }'
```

### 사용자 조회

```bash
# Display Name으로 Slack ID 조회
SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r --arg name "Reus" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)
```

---

## 🔴 토큰 오류 시 대응 (invalid_auth)

> **토큰 만료 또는 미설정 시 아래 가이드를 사용자에게 안내합니다.**

### 오류 감지

```bash
RESPONSE=$(curl -s -X POST "https://slack.com/api/chat.postMessage" ...)

if echo "$RESPONSE" | jq -e '.ok == false' > /dev/null; then
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  if [ "$ERROR" = "invalid_auth" ] || [ "$ERROR" = "token_expired" ]; then
    # 토큰 오류 → 사용자 가이드 출력
  fi
fi
```

### 사용자 안내 메시지

```markdown
## ⚠️ Slack 토큰 오류

Slack API 호출이 실패했습니다: `{error}`

### 해결 방법

1. **토큰 확인**: [Slack Bot Token 문서](https://semicolon-devteam.slack.com/docs/TS7EF9R6K/F09M5E15WTX)에서 최신 토큰을 확인하세요.

2. **`.env` 파일 설정**:
   ```bash
   # 프로젝트 루트에 .env 파일 생성/수정
   SLACK_BOT_TOKEN=xoxb-xxx-xxx-xxx
   ```

3. **테스트**:
   ```bash
   SLACK_BOT_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d '=' -f2)
   curl -s "https://slack.com/api/auth.test" \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN"
   ```

📖 자세한 설정 방법: [slack-config.md](../../packages/core/_shared/slack-config.md)
```

---

## 🔴 팀원 조회 규칙 (NON-NEGOTIABLE)

> **⚠️ 메시지 대상자가 명확하지 않으면 반드시 team-members 레퍼런스를 참조합니다.**

### 대상자 조회 워크플로우

```text
1. 대상자 정보 확인
   ↓
2. GitHub ID만 알고 있는 경우
   → packages/core/_shared/team-members.md 참조
   → GitHub ID → Slack Display Name 매핑 확인
   ↓
3. Slack Display Name으로 사용자 조회
   → curl로 users.list API 호출
   ↓
4. 조회 실패 시
   → team-members.md의 하드코딩된 Slack ID 사용 (폴백)
```

### 레퍼런스 파일

| 파일 | 용도 |
|------|------|
| `packages/core/_shared/team-members.md` | GitHub ID ↔ Slack 매핑 테이블 |
| `packages/core/_shared/slack-config.md` | Slack 설정 및 토큰 가이드 |

### 역할별 기본 대상자

| 역할 | 담당자 | Slack Name | 알림 상황 |
|------|--------|------------|----------|
| QA | 고권희 | Goni | 테스트 요청, 버그 리포트 |
| PO | 노영록 | Roki | Epic 생성, 요구사항 확인 |
| FE Lead | 전준영 | Reus | 프론트엔드 코드 리뷰 |
| BE Lead | 강용준 | kyago | 백엔드 코드 리뷰 |
| Infra | 서정원 | Garden | 인프라/배포 관련 |
| Design | 염현준 | Yeomso | 디자인 리뷰 |

---

## 채널 정보

| 채널 | ID | 용도 |
|------|-----|------|
| #_협업 | C09KNL91QBZ | 기본 알림 채널 |
| #개발사업팀 | - | Fallback 채널 |

---

## 사용 예시

### 기본 메시지 전송

```bash
SLACK_BOT_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d '=' -f2)

curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "작업이 완료되었습니다."
  }'
```

### 멘션 포함 전송

```bash
# 1. 사용자 ID 조회
SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r '.members[] | select(.profile.display_name == "Reus") | .id')

# 2. 멘션 포함 메시지 전송
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"channel\": \"C09KNL91QBZ\",
    \"text\": \"<@$SLACK_ID> 확인 부탁드립니다.\"
  }"
```

## Related

- [Slack 설정](../../packages/core/_shared/slack-config.md)
- [팀원 정보](../../packages/core/_shared/team-members.md)
- [토큰 관리 가이드](../../packages/core/_shared/token-management.md)
