# SEMO Engineering - Next.js Platform

> Next.js 프론트엔드/풀스택 개발

## Package Info

- **Package**: eng/platforms/nextjs
- **Version**: [../../VERSION](../../VERSION) 참조
- **Target**: cm-template, cm-* 프로젝트 (Next.js 기반)
- **Audience**: Frontend/Fullstack 개발자

---

## Mode Support

이 패키지는 **모드 시스템**을 지원합니다:

| 모드 | 파일 | 용도 |
|------|------|------|
| `mvp` | [modes/mvp.md](../../modes/mvp.md) | 속도 우선, 컨벤션 최소화 |
| `prod` | [modes/prod.md](../../modes/prod.md) | 품질 우선, 풀 컨벤션 (기본값) |

```markdown
# MVP 모드
[eng/nextjs --mode=mvp] 빠르게 로그인 페이지 만들어줘

# Production 모드 (기본값)
[eng/nextjs] 로그인 페이지 구현해줘
```

---

## Workflow: SDD + ADD

### Spec-First Branching

```text
dev 브랜치
  ├── [SDD Phase 1-3] Spec 작성 → specs/{domain}/*.md
  └── Feature 브랜치 분기 → {issue_number}-{title}
        └── [ADD Phase 4] 코드 구현 → Draft PR → Merge
```

### SDD (Spec-Driven Development)

| Phase | Command | Output |
|-------|---------|--------|
| 1 | `/speckit.specify` | spec.md |
| 2 | `/speckit.plan` | plan.md |
| 3 | `/speckit.tasks` | tasks.md |

### ADD (Agent-Driven Development)

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | 환경 설정 |
| v0.1.x | PROJECT | 도메인 구조 생성 |
| v0.2.x | TESTS | TDD 테스트 작성 |
| v0.3.x | DATA | 타입, 인터페이스 정의 |
| v0.4.x | CODE | 구현 코드 작성 |

---

## Architecture: DDD 4-Layer

```text
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

### MVP 모드 시

```text
src/app/{domain}/
├── _hooks/            # Layer 3 (비즈니스 로직)
├── _components/       # Layer 4 (UI)
└── page.tsx
```
2계층(hooks + components)만 사용 가능

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 작업 라우팅 및 의도 분석 |
| implementation-master | Phase-gated 구현 |
| quality-master | 코드 품질 검증 |
| ddd-architect | DDD 아키텍처 설계 |
| spec-master | 스펙 관리 |
| database-master | Supabase 연동 |
| migration-master | 마이그레이션 관리 |

---

## Skills

| Skill | 역할 |
|-------|------|
| implement | 구현 (ADD Phase 4) |
| auto-validate | 자동 검증 (tsc, lint, build) |
| verify | 종합 검증 |
| scaffold-domain | 도메인 구조 생성 |
| validate-architecture | DDD 아키텍처 검증 |
| typescript-write | TypeScript 코드 작성 |
| typescript-review | TypeScript 코드 리뷰 |
| git-workflow | Git 워크플로우 |
| fetch-supabase-example | Supabase 패턴 참조 |
| supabase-typegen | DB 타입 동기화 |
| health-check | 환경 검증 |

---

## Supabase 타입 동기화 (Cloud 환경 필수)

**DB 작업 시 반드시 타입 동기화 후 작업**:

```bash
# 1. 타입 생성 (Cloud 환경)
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts

# 2. 타입 활용
import { Database } from '@/lib/supabase/database.types';
type Post = Database['public']['Tables']['posts']['Row'];
```

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | DB 스키마 변경 | Migration 또는 Studio |
| 2 | **타입 동기화** | `npx supabase gen types ...` |
| 3 | Repository 구현 | 생성된 타입 사용 |
| 4 | 타입 파일 커밋 | `database.types.ts` 포함 |

> **On-Premise 환경**: CLI 연결 불가 → 수동 타입 정의 필요

---

## Quality Gates (Production Mode)

### Pre-Commit
```bash
npm run lint
npm run type-check
```

### Pre-PR
```bash
npm run test
npm run build
```

---

## PO 연동 (biz/discovery)

```text
1. PO: Epic 생성 → docs 레포에 이슈 생성
2. PO: (선택) Spec 초안 생성
3. 개발자: /speckit.specify로 spec.md 보완
4. 개발자: /speckit.plan, /speckit.tasks
5. 개발자: skill:implement로 구현
6. 개발자: skill:verify로 검증
```

---

## References

- [eng 레이어](../../CLAUDE.md)
- [MVP 모드](../../modes/mvp.md)
- [Production 모드](../../modes/prod.md)
- [spring 패키지](../spring/CLAUDE.md)
