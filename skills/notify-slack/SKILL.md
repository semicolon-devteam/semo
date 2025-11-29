---
name: notify-slack
description: Slack 채널에 메시지 전송. Use when (1) create-issues 완료 후, (2) /SAX:slack 커맨드, (3) 팀원 멘션 요청, (4) 이슈/PR 공유 요청.
tools: [Bash, Read]
model: inherit
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: notify-slack 호출 - {알림 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 채널에 메시지 전송 (Issue 알림, 커스텀 메시지, PR 리뷰 요청 등)
>
> **SoT 참조**: Slack ID 매핑은 `references/slack-id-mapping.md` 참조.

## When to Use (Orchestrator → Skill 호출 조건)

이 Skill은 **자동으로 호출**됩니다:

| 호출 시점 | 호출 조건 |
|-----------|-----------|
| create-issues 완료 후 | Issue 생성 완료 시 자동 호출 |
| `/SAX:slack` 커맨드 | 사용자가 Slack 메시지 요청 |
| 명시적 요청 | "Slack 알림 보내줘", "슬랙에 메시지 보내줘" |

**호출 흐름**:

```text
# 자동 호출
create-issues → Issues 생성 완료 → notify-slack Skill 자동 호출

# 커맨드 호출
/SAX:slack → Orchestrator → notify-slack Skill 호출
```

## Purpose

Slack 채널에 다양한 유형의 메시지를 전송합니다:

### 메시지 유형

| 유형 | 설명 | 트리거 |
|------|------|--------|
| **Issue 알림** | Issue 생성 완료 알림 | create-issues 완료 |
| **커스텀 메시지** | 자유 형식 메시지 전송 | /SAX:slack 커맨드 |
| **이슈 공유** | GitHub 이슈 링크 + 멘션 | 이슈 번호 포함 요청 |
| **PR 리뷰 요청** | PR 링크 + 리뷰어 멘션 | PR 번호 포함 요청 |

## Configuration

### Slack Bot Token

**Semicolon Notifier** 앱의 Bot Token을 사용합니다:

```
SLACK_BOT_TOKEN=xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb
```

### 대상 채널

| 채널 | Channel ID | 용도 |
|------|------------|------|
| #_협업 | 조회 필요 | 기본 알림 채널 |
| #개발사업팀 | 조회 필요 | 대체 채널 |

## Quick Start

```bash
# Slack 메시지 전송
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#_협업",
    "text": "📋 새로운 Issue가 생성되었습니다",
    "blocks": [...]
  }'
```

## Workflow

### Step 1: 알림 정보 수집

create-issues 또는 다른 Agent로부터 다음 정보를 받습니다:

```yaml
context:
  type: "spec" | "epic" | "task"
  number: 123
  title: "댓글 기능 구현"
  url: "https://github.com/semicolon-devteam/.../issues/123"
  project: "오피스"

issues:
  - repo: "cm-introduction-new"
    number: 456
    title: "댓글 CRUD API 구현"
    assignee: "developer-github-id"
  - repo: "cm-introduction-new"
    number: 789
    title: "댓글 UI 컴포넌트"
    assignee: "frontend-dev-id"
```

### Step 2: GitHub ID → Slack ID 매핑

[Slack ID 매핑 테이블](references/slack-id-mapping.md) 참조하여 멘션 ID 변환:

```bash
# 매핑 예시
github_id="developer-github-id" → slack_id="U0XXXXXXX"
```

### Step 3: 메시지 블록 구성

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📋 새로운 Issue가 생성되었습니다"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Spec*\n<https://github.com/.../issues/123|#123 댓글 기능 구현>"
        },
        {
          "type": "mrkdwn",
          "text": "*프로젝트*\n오피스"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Issues*"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "• <https://github.com/.../issues/456|#456 댓글 CRUD API 구현> - <@U0XXXXXXX>"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "구현을 시작해주세요! 🚀"
        }
      ]
    }
  ]
}
```

### Step 4: Slack API 호출

```bash
# 환경 변수 설정
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"
CHANNEL="#_협업"

# 메시지 전송
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @message.json
```

### Step 5: 완료 메시지

```markdown
[SAX] Skill: notify-slack 완료

✅ Slack 알림 전송 완료

**채널**: #_협업
**컨텍스트**: #123 댓글 기능 구현
**알림 대상**: @developer1, @developer2

팀원들에게 Issue 알림이 전송되었습니다.
```

## Error Handling

### 채널 접근 권한 없음

```markdown
⚠️ **Slack 알림 실패**

채널 접근 권한이 없습니다.
Semicolon Notifier 앱을 해당 채널에 추가해주세요.

**해결 방법**:
1. Slack에서 #_협업 채널 열기
2. 채널 설정 → 앱 추가
3. "Semicolon Notifier" 검색 후 추가
```

### Slack ID 매핑 없음

```markdown
⚠️ **Slack 멘션 불가**

GitHub ID `{github_id}`의 Slack ID 매핑이 없습니다.

**알림은 전송되지만 멘션은 생략됩니다.**

매핑 추가는 `sax-next/skills/notify-slack/references/slack-id-mapping.md` 수정
```

### API 호출 실패

```markdown
⚠️ **Slack API 오류**

{error_message}

수동으로 Slack 메시지를 보내주세요.
```

## SAX Message Format

```markdown
[SAX] Skill: notify-slack 호출 - Issue 알림

[SAX] Reference: slack-id-mapping.md 참조

[SAX] Skill: notify-slack 완료 - #_협업 채널
```

---

## 커스텀 메시지 모드 (/SAX:slack)

`/SAX:slack` 커맨드로 호출 시 커스텀 메시지 모드로 동작합니다.

### 사용 예시

```bash
/SAX:slack #cm-land 채널에 'Roki' 멘션해서 #520번 이슈카드 확인해달라고 메세지 보내줘
```

### 파라미터 파싱

| 항목 | 추출 방법 | 예시 |
|------|-----------|------|
| `channel` | `#채널명` 패턴 | `#cm-land` |
| `mentions` | 이름/GitHub ID | `Roki`, `jeonjunyeong` |
| `issue_number` | `#숫자` 패턴 (채널 제외) | `#520` |
| `pr_number` | `PR #숫자` 패턴 | `PR #42` |
| `message` | 나머지 텍스트 | "확인해달라고" |

### 이슈/PR 정보 조회

```bash
# 이슈 번호가 있으면 정보 조회
gh api repos/semicolon-devteam/{repo}/issues/{issue_number} --jq '{title, html_url}'

# PR 번호가 있으면 정보 조회
gh api repos/semicolon-devteam/{repo}/pulls/{pr_number} --jq '{title, html_url}'
```

**레포지토리 추론**:

- 채널명에서 추론: `#cm-land` → `cm-land` 레포
- 현재 작업 디렉토리에서 추론
- 명시적 지정: `cm-land#520`

### 커스텀 메시지 블록

```json
{
  "channel": "#cm-land",
  "text": "👋 @Roki 님, #520번 이슈 확인 부탁드립니다!",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "👋 <@U0XXXXXXX> 님, #520번 이슈 확인 부탁드립니다!"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📋 *이슈*: <https://github.com/semicolon-devteam/cm-land/issues/520|#520 이슈 제목>"
      }
    }
  ]
}
```

### 커스텀 메시지 완료

```markdown
[SAX] Skill: notify-slack 완료

✅ Slack 메시지 전송 완료

**채널**: #cm-land
**멘션**: @Roki
**이슈**: #520

메시지가 성공적으로 전송되었습니다.
```

## References

For detailed documentation, see:

- [Slack ID 매핑](references/slack-id-mapping.md) - GitHub ID ↔ Slack ID 매핑 테이블
- [메시지 템플릿](references/message-templates.md) - Slack Block Kit 메시지 템플릿
- [채널 설정](references/channel-config.md) - 대상 채널 설정 및 권한
- [/SAX:slack 커맨드](../../commands/SAX/slack.md) - 커스텀 메시지 커맨드
