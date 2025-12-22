# Slack 설정

> SEMO 패키지에서 공통으로 참조하는 Slack 설정 정보

## Bot Token

> 🔴 **토큰은 `.env` 파일에서 관리합니다. Git에 커밋하지 마세요!**

```bash
# 프로젝트 루트의 .env 파일에서 로드
source .env  # 또는 export $(cat .env | xargs)

# 환경변수 사용
echo $SLACK_BOT_TOKEN
```

### 설정 방법

1. 프로젝트 루트에 `.env` 파일 생성 (`.gitignore`에 포함됨)
2. 아래 Slack 문서에서 토큰을 복사하여 추가:

   **[Slack Bot Token 문서](https://semicolon-devteam.slack.com/docs/TS7EF9R6K/F09M5E15WTX)**

   ```
   SLACK_BOT_TOKEN=xoxb-xxx-xxx-xxx
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

```bash
# .env에서 토큰 로드 후 사용
SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}"

curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "메시지 내용"
  }'
```

### Claude Code에서 사용

Claude Code는 환경변수를 직접 읽을 수 없으므로, 스킬 실행 시 `.env` 파일에서 토큰을 읽습니다:

```bash
# .env 파일에서 토큰 읽기
SLACK_BOT_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d '=' -f2)
```

## 토큰 갱신 절차

1. Slack App 설정에서 새 토큰 생성
2. **프로젝트 루트의 `.env` 파일 업데이트**
3. 팀원에게 새 토큰 공유 (Slack DM 또는 1Password 등)

> 💡 `.env` 파일은 Git에 커밋되지 않으므로, 토큰 공유는 별도 보안 채널을 사용하세요.

## 토큰 테스트

```bash
# .env에서 토큰 로드
SLACK_BOT_TOKEN=$(grep SLACK_BOT_TOKEN .env | cut -d '=' -f2)

curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C09KNL91QBZ",
    "text": "SEMO Slack 연동 테스트"
  }'
```

## Related

- [팀원 정보 (GitHub ↔ Slack 매핑)](team-members.md)
- [notify-slack Skill](../skills/notify-slack/SKILL.md)
- [채널 설정](../skills/notify-slack/references/channel-config.md)
