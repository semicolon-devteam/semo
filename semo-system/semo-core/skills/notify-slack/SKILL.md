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

## 🔴 동적 사용자 조회 (필수)

> **⚠️ 중요**: 모든 사용자 멘션은 반드시 `<@SLACK_ID>` 형식 사용

하드코딩된 매핑 대신 Slack API로 실시간 조회

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
