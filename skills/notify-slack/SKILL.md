---
name: notify-slack
description: |
  Slack 채널에 메시지 전송 (공통 Skill). Use when (1) 이슈/태스크 알림,
  (2) 릴리스 알림, (3) /SAX:slack 커맨드, (4) 팀원 멘션 요청.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: notify-slack 호출 - {알림 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 채널에 다양한 유형의 메시지 전송 (SAX 공통 Skill)

## Purpose

모든 SAX 패키지에서 공통으로 사용하는 Slack 알림 Skill입니다.

### 지원 메시지 유형

| 유형 | 설명 | 트리거 |
|------|------|--------|
| **이슈 알림** | Issue/Task 생성 완료 알림 | Agent 완료 후 호출 |
| **릴리스 알림** | SAX 패키지 버전 업데이트 | version-manager 완료 후 |
| **커스텀 메시지** | 자유 형식 메시지 전송 | /SAX:slack 커맨드 |
| **PR 리뷰 요청** | PR 링크 + 리뷰어 멘션 | PR 번호 포함 요청 |

## Configuration

### Slack Bot Token

**Semicolon Notifier** 앱 사용:

```
SLACK_BOT_TOKEN=xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb
```

### 기본 채널

| 채널 | 용도 |
|------|------|
| `#_협업` | 기본 알림 채널 |

## Quick Start

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#_협업",
    "text": "메시지 내용",
    "blocks": [...]
  }'
```

## Workflow

### 공통 단계

1. **정보 수집**: 호출자로부터 알림 데이터 수신
2. **사용자 조회**: Slack API로 동적 사용자 ID 조회
3. **메시지 구성**: Block Kit 형식으로 구성
4. **API 호출**: Slack chat.postMessage 호출
5. **완료 보고**: 결과 메시지 출력

### 동적 사용자 조회 (Step 2)

> **하드코딩된 매핑 테이블 대신 Slack API를 통해 실시간으로 사용자 ID를 조회합니다.**

#### 조회 API 호출

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

# 전체 사용자 목록 조회
curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq '.members[] | select(.deleted == false and .is_bot == false) | {id, name, real_name, display_name: .profile.display_name}'
```

#### 매칭 우선순위

사용자 식별자(이름, GitHub ID 등)를 받으면 다음 순서로 매칭:

| 우선순위 | 필드 | 예시 |
|----------|------|------|
| 1 | `profile.display_name` | "Reus", "Garden" |
| 2 | `name` | "reus", "garden92" |
| 3 | `real_name` | "전준영", "서정원" |

#### 매칭 로직

```bash
# 예: "Reus" 또는 "전준영"으로 사용자 찾기
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

# 결과: URSQYUNQJ
```

#### 멘션 형식 생성

```bash
# Slack ID가 조회되면 멘션 형식으로 변환
if [ -n "$SLACK_ID" ]; then
  MENTION="<@$SLACK_ID>"  # <@URSQYUNQJ>
else
  MENTION="$SEARCH_NAME"   # 조회 실패 시 이름 그대로 표시
fi
```

#### 팀원 참조 (Semicolon)

| Display Name | Slack ID | Real Name |
|--------------|----------|-----------|
| Reus | URSQYUNQJ | 전준영 |
| Garden | URU4UBX9R | 서정원 |
| kyago | U02G8542V9U | 강용준 |
| Roki | U08P11ZQY04 | 노영록 |
| bon | U02V56WM3KD | 장현봉 |
| dwight.k | U06Q5KECB5J | 강동현 |
| Yeomso | U080YLC0MFZ | 염현준 |

> **Note**: 위 테이블은 참조용입니다. 실제 멘션 시에는 API를 통해 동적으로 조회합니다.

### 릴리스 알림 (version-manager 연동)

version-manager가 버저닝 완료 후 자동 호출:

```yaml
input:
  type: "release"
  package: "sax-po"
  version: "0.16.0"
  changelog: |
    ## Added
    - report-bug: 버그 리포트 Skill 추가
```

**메시지 블록**:

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚀 SAX 패키지 업데이트"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*패키지*\nsax-po"
        },
        {
          "type": "mrkdwn",
          "text": "*버전*\n`v0.16.0`"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*변경 내역*\n• report-bug: 버그 리포트 Skill 추가"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "🔗 <https://github.com/semicolon-devteam/sax-po|GitHub>"
        }
      ]
    }
  ]
}
```

### 이슈/태스크 알림

```yaml
input:
  type: "issue"
  context:
    number: 123
    title: "댓글 기능 구현"
    url: "https://github.com/..."
  issues:
    - repo: "core-backend"
      number: 456
      title: "댓글 API 구현"
      assignee: "kyago"
```

### 커스텀 메시지 (/SAX:slack)

```bash
/SAX:slack #_협업 채널에 'Roki' 멘션해서 #520 이슈 확인 요청
```

**파라미터 파싱**:

| 항목 | 추출 방법 | 예시 |
|------|-----------|------|
| `channel` | `#채널명` 패턴 | `#_협업` |
| `mentions` | 이름/GitHub ID | `Roki` |
| `issue_number` | `#숫자` 패턴 | `#520` |

## 완료 메시지

```markdown
[SAX] Skill: notify-slack 완료

✅ Slack 알림 전송 완료

**채널**: #_협업
**유형**: {release|issue|custom}
```

## Error Handling

### 채널 접근 권한 없음

```markdown
⚠️ **Slack 알림 실패**

채널 접근 권한이 없습니다.
Semicolon Notifier 앱을 해당 채널에 추가해주세요.
```

### Slack 사용자 조회 실패

```markdown
⚠️ **Slack 멘션 불가**

`{search_name}`에 해당하는 Slack 사용자를 찾을 수 없습니다.
알림은 전송되지만 멘션은 생략됩니다.

**확인 사항**:
- Slack 워크스페이스에 가입된 사용자인지 확인
- display_name, name, real_name 중 하나와 일치하는지 확인
```

## SAX Message Format

```markdown
[SAX] Skill: notify-slack 호출 - {알림 유형}

[SAX] Skill: notify-slack 완료 - #_협업 채널
```

## References

- [동적 사용자 조회](references/slack-id-mapping.md) - Slack API 사용자 조회 가이드
- [메시지 템플릿](references/message-templates.md) - Block Kit 템플릿
- [채널 설정](references/channel-config.md) - 채널 설정 및 권한
