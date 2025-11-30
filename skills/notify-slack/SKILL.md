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
2. **ID 매핑**: GitHub ID → Slack ID 변환 (references/slack-id-mapping.md)
3. **메시지 구성**: Block Kit 형식으로 구성
4. **API 호출**: Slack chat.postMessage 호출
5. **완료 보고**: 결과 메시지 출력

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

### Slack ID 매핑 없음

```markdown
⚠️ **Slack 멘션 불가**

GitHub ID `{github_id}`의 Slack ID 매핑이 없습니다.
알림은 전송되지만 멘션은 생략됩니다.
```

## SAX Message Format

```markdown
[SAX] Skill: notify-slack 호출 - {알림 유형}

[SAX] Skill: notify-slack 완료 - #_협업 채널
```

## References

- [Slack ID 매핑](references/slack-id-mapping.md) - GitHub ID ↔ Slack ID
- [메시지 템플릿](references/message-templates.md) - Block Kit 템플릿
- [채널 설정](references/channel-config.md) - 채널 설정 및 권한
