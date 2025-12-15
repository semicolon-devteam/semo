---
name: semo-architecture-checker
description: |
  SEMO 아키텍처 검증. Use when (1) "아키텍처 체크",
  (2) SEMO 구조 검증, (3) 설치 상태 확인.
tools: [Read, Bash, Glob]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: semo-architecture-checker 호출`

# semo-architecture-checker Skill

> SEMO 설치 및 아키텍처 검증

## Trigger Keywords

- "아키텍처 체크", "구조 검증"
- "SEMO 상태 확인"
- "/SEMO:health"

## 검증 항목

1. semo-system/ 존재 여부
2. .claude/ 심볼릭 링크 상태
3. settings.json MCP 설정
4. CLAUDE.md 존재 여부
