---
name: notify-slack
description: |
  Slack 채널에 메시지 전송 (공통 Skill). Use when (1) 이슈/태스크 알림,
  (2) 릴리스 알림, (3) /SEMO:slack 커맨드, (4) 팀원 멘션 요청.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: notify-slack 호출 - {알림 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# notify-slack Skill

> Slack 채널에 다양한 유형의 메시지 전송 (SEMO 공통 Skill)

## Purpose

모든 SEMO 패키지에서 공통으로 사용하는 Slack 알림 Skill입니다.

### 지원 메시지 유형

| 유형 | 설명 | 트리거 |
|------|------|--------|
| **이슈 알림** | Issue/Task 생성 완료 알림 | Agent 완료 후 호출 |
| **릴리스 알림** | SEMO 패키지 버전 업데이트 | version-manager 완료 후 |
| **커스텀 메시지** | 자유 형식 메시지 전송 | /SEMO:slack 커맨드 |

## 🔴 동적 채널 조회 (필수)

> **⚠️ 중요**: 채널명을 하드코딩하지 말고, 반드시 동적 조회를 사용하세요.

### 채널 조회 워크플로우

```text
1. slack_find_channel 도구로 채널 검색
   - 1차: #{name} (정확히 일치)
   - 2차: #_{name} (언더스코어 접두사)
   - 3차: 부분 일치
   - Fallback: #_협업

2. 찾은 채널 ID로 slack_send_message 호출
```

### MCP 도구 사용법

```typescript
// 1단계: 채널 찾기 (동적 조회)
mcp__semo-integrations__slack_find_channel({
  name: "semo",           // 찾을 채널명
  fallback: "#_협업"      // Fallback 채널 (기본값)
})
// 반환: 채널 ID 또는 Fallback 채널 정보

// 2단계: 메시지 전송
mcp__semo-integrations__slack_send_message({
  channel: "#_협업",      // 1단계에서 찾은 채널
  text: "메시지 내용"
})
```

### 채널 목록 조회

```typescript
// 전체 채널 목록 조회
mcp__semo-integrations__slack_list_channels({
  limit: 100              // 최대 반환 수
})

// 특정 키워드로 검색
mcp__semo-integrations__slack_list_channels({
  search: "cm-",          // 부분 일치 검색
  limit: 20
})
```

## 🔴 동적 사용자 조회 (필수)

> **⚠️ 중요**: 모든 사용자 멘션은 반드시 `<@SLACK_ID>` 형식 사용

하드코딩된 매핑 대신 Slack API로 실시간 조회:

```typescript
mcp__semo-integrations__slack_lookup_user({
  name: "Reus"            // display_name, name, 또는 real_name
})
// 반환: ID, 멘션 형식 (<@U12345678>)
```

## Quick Start

heredoc 방식으로 Slack API 호출 (쉘 이스케이프 문제 방지)

## Output

```markdown
[SEMO] Skill: notify-slack 완료

✅ Slack 알림 전송 완료

**채널**: #_협업
**유형**: {release|issue|custom}
```

## References

- [User Lookup](references/slack-id-mapping.md)
- [Message Templates](references/message-templates.md)
- [Channel Config](references/channel-config.md)
