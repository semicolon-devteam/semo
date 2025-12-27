---
name: circuit-breaker
description: |
  오류 차단 및 복구. Use when (1) 반복 오류 감지,
  (2) 무한 루프 방지, (3) 오류 패턴 분석.
tools: [Read]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: circuit-breaker` 시스템 메시지를 첫 줄에 출력하세요.

# circuit-breaker Skill

> 오류 차단 및 복구 지원

## 동작

1. 오류 패턴 분석
2. 근본 원인 추정
3. 해결 방안 제시
4. 작업 중단 권고 (필요시)
