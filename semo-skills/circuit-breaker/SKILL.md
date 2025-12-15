---
name: circuit-breaker
description: |
  오류 차단 및 복구. Use when (1) 반복 오류 감지,
  (2) 무한 루프 방지, (3) 오류 패턴 분석.
tools: [Read]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: circuit-breaker 호출`

# circuit-breaker Skill

> 오류 차단 및 복구 지원

## Trigger Keywords

- 동일 오류 3회 이상 반복
- 무한 루프 감지
- 빌드/테스트 실패 반복

## 동작

1. 오류 패턴 분석
2. 근본 원인 추정
3. 해결 방안 제시
4. 작업 중단 권고 (필요시)
