---
name: slack
description: Slack 채널에 메시지 전송 (공통)
---

# /SEMO:slack Command

Slack 채널에 다양한 유형의 메시지를 전송합니다.

> **공통 커맨드**: 모든 SEMO 프로젝트에서 사용 가능

## Trigger

- `/SEMO:slack` 명령어
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

`/SEMO:slack` 실행 시 MCP를 통해 Slack API를 호출합니다.

```markdown
[SEMO] Command: slack 실행

> Slack 메시지를 전송합니다.
```

## Workflow

### Step 1: 메시지 유형 확인

```markdown
[SEMO] Command: slack 실행

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

MCP `semo-integrations`의 `slack_send_message` 도구를 사용합니다.

### Step 4: 완료 안내

```markdown
[SEMO] Command: slack 완료

Slack 메시지 전송 완료

**채널**: #_협업
**유형**: {메시지 유형}
```

## Configuration

### 환경 변수 (MCP)

`.claude/settings.json`에서 MCP 설정:

```json
{
  "mcpServers": {
    "semo-integrations": {
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
      }
    }
  }
}
```

### 기본 채널

| 채널 | ID | 용도 |
|------|-----|------|
| #_협업 | C09KNL91QBZ | 기본 알림 |

## User Mention

팀원 멘션 시 `<@SLACK_USER_ID>` 형식 사용:
- `@channel` - 채널 전체
- `<@U12345678>` - 특정 사용자

## Related

- [Slack Integration](../../semo-integrations/slack/INTEGRATION.md)
- [SEMO MCP Server](../../packages/mcp-server/)
