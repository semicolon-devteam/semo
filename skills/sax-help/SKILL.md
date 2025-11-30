---
name: sax-help
description: SAX-Backend 사용 가이드 및 도움말. Use when (1) "도움말", (2) "SAX 뭐야?", (3) "어떻게 써?"
tools: [Read]
---

# SAX Help Skill

> SAX-Backend 패키지 사용 가이드

## Quick Commands

| 명령 | 설명 |
|------|------|
| `skill:spec` | SDD Phase 1-3 명세 작성 |
| `skill:implement` | ADD Phase 4 구현 |
| `skill:verify` | Phase 5 검증 |
| `skill:scaffold-domain` | 도메인 구조 생성 |
| `skill:sync-openapi` | API 스펙 동기화 |
| `skill:lookup-migration` | DB 스키마 확인 |
| `skill:verify-reactive` | Reactive 패턴 검증 |
| `skill:check-team-codex` | 팀 코덱스 검증 |
| `skill:git-workflow` | Git 워크플로우 |

## Workflow Overview

```text
PO Draft Task → spec.md → plan.md → tasks.md
                    ↓
        implement (v0.0.x → v0.4.x)
                    ↓
           verify → PR → Merge
```

## ADD Phases

| Phase | Name | Action |
|-------|------|--------|
| v0.0.x | CONFIG | 의존성 확인 |
| v0.1.x | PROJECT | 구조 생성 |
| v0.2.x | TESTS | TDD 테스트 |
| v0.3.x | DATA | Entity, DTO |
| v0.4.x | CODE | Service, Controller |

## Key Patterns

- **CQRS**: CommandService / QueryService 분리
- **Reactive**: .block() 절대 금지
- **String const**: enum 대신 사용
- **Sealed Exception**: 도메인별 예외 계층

## Related

- [CLAUDE.md](../CLAUDE.md) - 패키지 설정
- [Orchestrator](../agents/orchestrator/orchestrator.md) - 라우팅
