---
name: coder
description: |
  코드 작성 및 수정. Use when (1) "코드 작성해줘", "구현해줘",
  (2) 기능 추가/수정, (3) 버그 수정.
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: coder` 시스템 메시지를 첫 줄에 출력하세요.

# coder Skill

> 코드 작성 및 수정 자동화

## Trigger Keywords

- "코드 작성해줘", "구현해줘"
- "기능 추가해줘", "수정해줘"
- "버그 수정해줘"

## Workflow

1. 요구사항 분석
2. 기존 코드 파악 (Read, Glob, Grep)
3. 코드 작성/수정 (Write, Edit)
4. 검증 (Bash: lint, typecheck)

## Quality Rules

- 기존 코드 스타일 준수
- 타입 안전성 확보
- 불필요한 변경 최소화
