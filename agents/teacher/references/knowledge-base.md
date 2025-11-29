# Knowledge Base

> teacher Agent 핵심 지식 베이스

## DDD 4-Layer Architecture

```
app/{domain}/
├── _repositories/    # Layer 1: 서버사이드 Supabase 데이터 접근
├── _api-clients/     # Layer 2: 브라우저 HTTP 통신 (Factory Pattern)
├── _hooks/           # Layer 3: React Query + 상태 관리
└── _components/      # Layer 4: 도메인 전용 UI
```

**Layer Responsibilities:**
- **Repository**: Supabase RPC 호출, 서버 전용
- **API Client**: fetch 기반 HTTP 통신, 클라이언트 전용
- **Hooks**: React Query로 상태 관리, 캐싱
- **Components**: 도메인 로직과 UI 결합

## SDD + ADD Workflow

```
SDD Phase 1-3 (Specification):
  /speckit.specify → spec.md
  /speckit.plan → plan.md
  /speckit.tasks → tasks.md

ADD Phase 4 (Implementation):
  v0.0.x CONFIG → v0.1.x PROJECT → v0.2.x TESTS →
  v0.3.x DATA → v0.4.x CODE
```

## Constitution 9 Principles

> **SoT 참조**: Constitution 원칙은 `sax-core/PRINCIPLES.md`에서 관리됩니다.
>
> 참조: [SAX Core Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md) | 로컬: `.claude/sax-core/PRINCIPLES.md`

**주요 원칙 (요약)**:
1. DDD Architecture (NON-NEGOTIABLE)
2. SSR-First Development
3. Test-Driven Quality (NON-NEGOTIABLE)
4. Performance Excellence
5. API Mode Flexibility
6. Atomic Design System
7. Type Safety
8. Spec-Driven Development
9. Agent-Driven Collaboration

## Supabase Schema Verification (MCP 우선)

스키마 관련 질문에는 **Supabase MCP를 우선 사용**:

```bash
# 우선순위 1: Supabase MCP (실시간 클라우드 스키마)
mcp__supabase__list_tables()
mcp__supabase__get_table_schema()

# 우선순위 2: 로컬 타입 파일
@src/lib/supabase/database.types.ts

# 우선순위 3: core-supabase 참조 구현
gh api repos/semicolon-devteam/core-supabase/...
```

## External Resources

**SAX Core (SoT)**:
- [SAX Core Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core Team Rules](https://github.com/semicolon-devteam/sax-core/blob/main/TEAM_RULES.md)

**Wiki (보조)**:
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Git Rules](https://github.com/semicolon-devteam/docs/wiki/rules-git)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)
