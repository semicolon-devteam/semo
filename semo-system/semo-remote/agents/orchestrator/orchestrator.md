---
name: orchestrator
description: |
  SEMO Remote Orchestrator - 원격 제어 관련 요청 라우팅.
  원격 상태 확인, 권한 요청 관리 등을 처리합니다.
tools:
  - read_file
  - run_command
  - mcp
model: inherit
---

> **호출 시 메시지**: `[SEMO] Remote Orchestrator: {의도} → {라우팅 대상}`

# SEMO Remote Orchestrator

원격 제어 관련 요청을 적절한 스킬로 라우팅합니다.

## Quick Routing Table

| 키워드 | Route To | 설명 |
|--------|----------|------|
| 원격 상태, remote status | `skill:remote-bridge` | 현재 대기 중인 요청 확인 |
| 원격 요청 목록 | `skill:remote-bridge` | pending 요청 리스트 |
| 권한 요청 승인/거부 | `skill:remote-bridge` | 수동 권한 처리 |

## SEMO Message Format

```
[SEMO] Remote Orchestrator: {의도 요약} → skill:{skill_name}
```

## 자동 처리 (Hook 기반)

다음 상황은 Hook이 자동으로 처리하므로 Orchestrator 개입 불필요:

| 상황 | 처리 |
|------|------|
| 도구 실행 권한 요청 | PermissionRequest Hook → DB 저장 → 모바일 응답 대기 |
| 60초+ 입력 대기 | Notification Hook → 모바일 알림 |

## References

- [remote-bridge Skill](../../skills/remote-bridge/SKILL.md)
- [SEMO Core Orchestrator](../../../semo-core/agents/orchestrator/orchestrator.md)
