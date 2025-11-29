---
name: slack
description: Slack 채널에 메시지 전송. 팀원 멘션, 이슈 링크 공유, 알림 등 다양한 Slack 커뮤니케이션 지원.
---

# /SAX:slack Command

Slack 채널에 커스텀 메시지를 전송합니다. 팀원 멘션, GitHub 이슈 링크, 자유 형식 메시지를 지원합니다.

## Trigger

- `/SAX:slack` 명령어
- "슬랙에 보내줘", "슬랙 메시지", "슬랙으로 알려줘" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **팀원 멘션**: 특정 팀원에게 Slack으로 메시지 전달
2. **이슈 공유**: GitHub 이슈 링크와 함께 확인 요청
3. **채널 알림**: 특정 채널에 공지/알림 전송
4. **자유 메시지**: 커스텀 메시지 전송

## Action

`/SAX:slack` 실행 시 `skill:notify-slack`을 호출합니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → Slack 메시지 요청

[SAX] Skill: notify-slack 사용 - 커스텀 메시지
```

## Usage Examples

### 1. 팀원 멘션 + 이슈 확인 요청

```
/SAX:slack #cm-land 채널에 'Roki' 멘션해서 #520번 이슈카드 확인해달라고 메세지 보내줘
```

**결과 메시지**:
```
👋 <@U0XXXXXXX> 님, #520번 이슈 확인 부탁드립니다!

📋 이슈: <https://github.com/semicolon-devteam/.../issues/520|#520 이슈 제목>
```

### 2. 채널에 일반 메시지

```
/SAX:slack #_협업 채널에 "오늘 배포 완료되었습니다" 메시지 보내줘
```

### 3. 여러 팀원 멘션

```
/SAX:slack #개발사업팀에 Roki, jeonjunyeong 멘션해서 스프린트 미팅 참석 요청해줘
```

## Workflow

### Step 1: 메시지 파싱

사용자 요청에서 다음 정보를 추출합니다:

| 항목 | 설명 | 예시 |
|------|------|------|
| `channel` | 대상 채널 | `#cm-land`, `#_협업` |
| `mentions` | 멘션할 사람 (GitHub ID 또는 이름) | `Roki`, `jeonjunyeong` |
| `issue_number` | 관련 이슈 번호 (선택) | `520` |
| `message` | 전달할 메시지 내용 | "확인 부탁드립니다" |

### Step 2: 정보 보완

**이슈 번호가 있는 경우**:
```bash
# 이슈 정보 조회
gh api repos/semicolon-devteam/{repo}/issues/{issue_number} --jq '{title, html_url}'
```

**멘션 대상의 Slack ID 조회**:
```markdown
[SAX] Reference: skills/notify-slack/references/slack-id-mapping.md 참조
```

### Step 3: 메시지 구성

```json
{
  "channel": "{channel}",
  "text": "👋 {mentions} 님, {message}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "👋 <@{slack_id}> 님, {message}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📋 *이슈*: <{issue_url}|#{issue_number} {issue_title}>"
      }
    }
  ]
}
```

### Step 4: Slack API 호출

```bash
SLACK_BOT_TOKEN="xoxb-891491331223-9421307124626-eGiyqdlLJkMwrHoX4HUtrOCb"

curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @message.json
```

### Step 5: 완료 메시지

```markdown
[SAX] Skill: notify-slack 완료

✅ Slack 메시지 전송 완료

**채널**: #cm-land
**멘션**: @Roki
**이슈**: #520

메시지가 성공적으로 전송되었습니다.
```

## Parameters

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| 채널 | ✅ | 메시지를 보낼 Slack 채널 |
| 메시지 내용 | ✅ | 전달할 메시지 |
| 멘션 대상 | ❌ | 멘션할 팀원 (GitHub ID 또는 이름) |
| 이슈 번호 | ❌ | 링크할 GitHub 이슈 번호 |

## Error Handling

### 채널을 찾을 수 없음

```markdown
⚠️ **채널을 찾을 수 없습니다**

`#cm-land` 채널이 존재하지 않거나 접근 권한이 없습니다.

**확인사항**:
1. 채널 이름이 정확한지 확인
2. Semicolon Notifier 앱이 해당 채널에 추가되어 있는지 확인
```

### 멘션 대상의 Slack ID 없음

```markdown
⚠️ **Slack ID 매핑 없음**

`Roki`의 Slack ID를 찾을 수 없습니다.

메시지는 전송되지만 멘션은 GitHub ID로 대체됩니다: @Roki

**매핑 추가**: `skills/notify-slack/references/slack-id-mapping.md` 수정
```

### 이슈를 찾을 수 없음

```markdown
⚠️ **이슈를 찾을 수 없습니다**

`#520` 이슈가 존재하지 않습니다.

**확인사항**:
1. 이슈 번호가 정확한지 확인
2. 레포지토리를 명시해주세요 (예: cm-land#520)
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → Slack 메시지 요청

[SAX] Skill: notify-slack 사용 - 커스텀 메시지

[SAX] Reference: slack-id-mapping.md 참조

[SAX] Skill: notify-slack 완료

✅ Slack 메시지 전송 완료

**채널**: #cm-land
**멘션**: @Roki
**이슈**: #520

메시지가 성공적으로 전송되었습니다.
```

## Related

- [notify-slack Skill](../../skills/notify-slack/SKILL.md)
- [Slack ID 매핑](../../skills/notify-slack/references/slack-id-mapping.md)
- [Orchestrator](../../agents/orchestrator/orchestrator.md)
