---
name: assign-task
description: |
  작업자에게 Task 할당 + 작업 포인트 설정 + Slack 알림의 통합 워크플로우.
  Use when (1) Task 할당 시, (2) 담당자 지정 + 포인트 설정 + 알림 한 번에 처리,
  (3) /SEMO:pm assign 커맨드.
tools: [Bash, Read, AskUserQuestion]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: assign-task 호출` 메시지를 첫 줄에 출력하세요.

# assign-task Skill

> Task 할당의 완성된 프로세스: 담당자 지정 → 작업 포인트 확인/설정 → Slack 알림

## Purpose

Task를 작업자에게 할당할 때 필요한 모든 단계를 하나의 통합 워크플로우로 처리합니다.

### 통합 프로세스

| 단계 | 설명 | 조건 |
|------|------|------|
| 1. 담당자 지정 | Issue의 assignee 설정 | 필수 |
| 2. 작업 포인트 확인 | 기존 포인트 확인 | 자동 |
| 3. 작업 포인트 설정 | 누락 시 사용자 승인 후 설정 | 누락 시 |
| 4. Slack 알림 | 담당자에게 할당 알림 전송 | 필수 |

## Workflow

```text
Task 할당 요청
    ↓
1. Issue 정보 조회 (담당자, 작업 포인트)
    ↓
2. 담당자 지정 (gh issue edit --add-assignee)
    ↓
3. 작업 포인트 확인
   ├─ 있음 → Step 4로
   └─ 없음 → 포인트 제안 → 사용자 승인 → 설정
    ↓
4. Slack 알림 전송 (#_협업 채널)
    ↓
완료
```

## Quick Start

### 기본 사용

```yaml
repo: "command-center"
number: 123
assignee: "kyago"
```

### 복수 Task

```yaml
tasks:
  - repo: "command-center"
    number: 123
    assignee: "kyago"
  - repo: "cm-land"
    number: 456
    assignee: "Garden"
    estimate: 5
```

## Output

### 성공 (전체 프로세스)

```markdown
[SEMO] Skill: assign-task 완료

✅ Task 할당 완료

| Repo | # | Task | 담당자 | 작업량 |
|------|---|------|--------|--------|
| command-center | #123 | 댓글 기능 구현 | @kyago | 3pt |

**처리 내역**:
- ✅ 담당자 지정: @kyago
- ✅ 작업 포인트: 3pt (신규 설정)
- ✅ Slack 알림: #_협업 채널 전송 완료
```

## References

- [작업 포인트 제안 규칙](references/estimate-rules.md)
- [API 호출 상세](references/api-calls.md)
- [Slack 메시지 형식](references/slack-message.md)

## Related

- [set-estimate](../set-estimate/SKILL.md) - 작업 포인트 설정 로직
- [start-task](../start-task/SKILL.md) - 작업 시작 (이터레이션 자동 할당)
- [assign-to-sprint](../assign-to-sprint/SKILL.md) - Sprint 할당
- [notify-slack](../../../semo-core/skills/notify-slack/SKILL.md) - Slack 알림 공통 스킬
