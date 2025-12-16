---
name: start-task
description: |
  Task 작업 시작 처리. Use when (1) Task 상태를 '작업중'으로 변경,
  (2) 시작일 자동 설정, (3) 현재 이터레이션 자동 할당, (4) /SEMO:sprint start 커맨드.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: start-task 호출` 메시지를 첫 줄에 출력하세요.

# start-task Skill

> Task 작업 시작 시 상태, 시작일, 이터레이션을 한 번에 설정

## Purpose

Task 작업을 시작할 때 필요한 모든 Projects 필드를 자동으로 설정합니다.

| 자동 설정 항목 | 설명 |
|---------------|------|
| **상태** | '작업중'으로 변경 |
| **시작일** | 오늘 날짜로 설정 |
| **이터레이션** | 현재(Current) 이터레이션으로 할당 |

## Workflow

```text
작업 시작 요청
    ↓
1. 대상 Task(Issue) 확인
2. Projects Item ID 조회
3. 현재 이터레이션 조회
4. 3개 필드 일괄 업데이트
   - 상태 → 작업중
   - 시작일 → 오늘
   - 이터레이션 → Current
    ↓
완료
```

## Quick Start

```yaml
# 단일 Task
repo: "command-center"
number: 123

# 복수 Task
tasks:
  - repo: "command-center"
    number: 123
  - repo: "cm-land"
    number: 456
```

## Output

```markdown
[SEMO] Skill: start-task 완료

✅ 2개 Task 작업 시작 처리 완료

| Repo | # | Task | 상태 | 시작일 | 이터레이션 |
|------|---|------|------|--------|-----------|
| command-center | #123 | 댓글 API | 작업중 | 2025-12-01 | 12월 1/4 |
| cm-land | #456 | 알림 연동 | 작업중 | 2025-12-01 | 12월 1/4 |
```

## References

- [API Calls](references/api-calls.md) - GraphQL API 호출 상세
- [Error Handling](references/error-handling.md) - 에러 처리 가이드

## Related

- [assign-to-sprint](../assign-to-sprint/SKILL.md) - Sprint 사전 할당
- [set-estimate](../set-estimate/SKILL.md) - 작업량 설정
