---
name: memory
description: |
  컨텍스트 관리. Use when (1) "기억해줘", "저장해줘",
  (2) 프로젝트 상태 업데이트, (3) 결정 기록.
tools: [Read, Write, Edit]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: memory 호출`

# memory Skill

> 세션 간 컨텍스트 영속화

## Trigger Keywords

- "기억해줘", "저장해줘"
- "컨텍스트 업데이트"
- "결정 기록해줘"

## 관리 파일

- `.claude/memory/context.md` - 프로젝트 상태
- `.claude/memory/decisions.md` - 아키텍처 결정
- `.claude/memory/rules/` - 프로젝트별 규칙
