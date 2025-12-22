---
name: planner
description: |
  구현 계획 수립. Use when (1) "계획 세워줘", "설계해줘",
  (2) 복잡한 기능 구현 전, (3) 리팩토링 계획.
tools: [Read, Glob, Grep]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: planner` 시스템 메시지를 첫 줄에 출력하세요.

# planner Skill

> 구현 계획 수립 자동화

## Trigger Keywords

- "계획 세워줘", "설계해줘"
- "어떻게 구현할까"
- "리팩토링 계획"

## Workflow

1. 요구사항 분석
2. 기존 코드베이스 파악
3. 구현 단계 정의
4. 의존성 및 리스크 분석
