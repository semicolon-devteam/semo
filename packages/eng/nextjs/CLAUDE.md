# SEMO Engineering - Next.js Platform

> Next.js 프론트엔드/풀스택 개발

## Package Info

- **Package**: eng/nextjs
- **Version**: [VERSION](./VERSION) 참조
- **Target**: cm-template, cm-* 프로젝트

## Core Rules (상속)

> 📄 [semo-core/principles/](../../semo-core/principles/) + [eng/CLAUDE.md](../CLAUDE.md) 참조

---

## nextjs 고유: DDD 4-Layer Architecture

```
src/app/{domain}/
├── _repositories/     # Layer 1: 서버사이드 데이터 접근
├── _api-clients/      # Layer 2: 브라우저 HTTP 통신
├── _hooks/            # Layer 3: React 상태 관리
├── _components/       # Layer 4: 도메인 전용 UI
└── page.tsx
```

**MVP 모드**: hooks + components (2계층)만 사용

## nextjs 고유: ADD Phase

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | 환경 설정 |
| v0.1.x | PROJECT | 도메인 구조 생성 |
| v0.2.x | TESTS | TDD 테스트 작성 |
| v0.3.x | DATA | 타입, 인터페이스 정의 |
| v0.4.x | CODE | 구현 코드 작성 |
| v0.5.x | E2E | Playwright 런타임 테스트 |

## nextjs 고유: Supabase 타입 동기화

DB 작업 시 반드시 타입 동기화:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 작업 라우팅 |
| implementation-master | Phase-gated 구현 |
| quality-master | 코드 품질 검증 |
| ddd-architect | DDD 아키텍처 설계 |

## Skills

| Skill | 역할 |
|-------|------|
| implement | 구현 (ADD Phase 4) |
| verify | 종합 검증 |
| scaffold-domain | 도메인 구조 생성 |
| e2e-test | Playwright E2E 테스트 |
| git-workflow | Git 워크플로우 |

## References

- [eng 레이어](../CLAUDE.md)
- [orchestrator](agents/orchestrator/orchestrator.md)
