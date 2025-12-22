---
name: semo-architecture-checker
description: |
  SEMO 아키텍처 검증. Use when (1) "아키텍처 체크",
  (2) SEMO 구조 검증, (3) 설치 상태 확인.
tools: [Read, Bash, Glob]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: semo-architecture-checker` 시스템 메시지를 첫 줄에 출력하세요.

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
