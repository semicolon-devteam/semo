---
name: slack
description: Slack 채널에 메시지 전송 - notify-slack skill 호출 (공통)
---

# /SAX:slack Command

Slack 채널에 다양한 유형의 메시지를 전송합니다.

> **공통 커맨드**: 모든 SAX 패키지에서 사용 가능

## Trigger

- `/SAX:slack` 명령어
- "슬랙에 알려줘", "슬랙 메시지", "팀에 공유" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **이슈 알림**: 생성된 Issue/Task 알림
2. **릴리스 알림**: 패키지 버전 업데이트 공지
3. **PR 리뷰 요청**: PR 링크와 리뷰어 멘션
4. **커스텀 메시지**: 자유 형식 메시지 전송

## Supported Message Types

| 유형 | 설명 | 기본 채널 |
|------|------|----------|
| issue | Issue/Task 생성 알림 | #_협업 |
| release | 패키지 릴리스 알림 | #_협업 |
| pr_review | PR 리뷰 요청 | #_협업 |
| custom | 자유 형식 메시지 | 지정 필요 |

## Action

`/SAX:slack` 실행 시 `sax-core/skill:notify-slack`을 호출합니다.

```markdown
[SAX] Skill: notify-slack 호출 - {메시지 유형}

> sax-core/skills/notify-slack 스킬을 호출합니다.
```

## Workflow

### Step 1: 메시지 유형 확인

```markdown
[SAX] Skill: notify-slack 호출

## Slack 메시지 전송

어떤 유형의 메시지를 보낼까요?

1. **이슈 알림** - Issue/Task 생성 알림
2. **릴리스 알림** - 패키지 버전 업데이트
3. **PR 리뷰 요청** - PR 링크 + 리뷰어 멘션
4. **커스텀 메시지** - 자유 형식

번호를 선택하거나 메시지 내용을 직접 입력하세요.
```

### Step 2: 정보 수집

메시지 유형에 따라 필요한 정보를 수집합니다.

### Step 3: 메시지 전송

```bash
SLACK_BOT_TOKEN="xoxb-..." curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "#_협업",
    "text": "메시지 내용",
    "blocks": [...]
  }'
```

### Step 4: 완료 안내

```markdown
[SAX] Skill: notify-slack 완료

✅ Slack 메시지 전송 완료

**채널**: #_협업
**유형**: {메시지 유형}
```

## Expected Output

### 이슈 알림

```markdown
[SAX] Skill: notify-slack 호출 - 이슈 알림

✅ Slack 메시지 전송 완료

**채널**: #_협업
**내용**: Issue #123 생성 알림
```

### 릴리스 알림

```markdown
[SAX] Skill: notify-slack 호출 - 릴리스 알림

✅ Slack 메시지 전송 완료

**채널**: #_협업
**패키지**: sax-core v0.10.0
```

## User Mention

팀원을 멘션할 때 Slack API로 동적 조회합니다:

```bash
# 사용자 목록 조회
curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq '.members[] | {id, name, real_name}'
```

**멘션 방식**: `<@SLACK_USER_ID>` 형식 사용

## Related

- [notify-slack Skill](../../skills/notify-slack/SKILL.md)
- [SAX Core - Message Rules](../../MESSAGE_RULES.md)
