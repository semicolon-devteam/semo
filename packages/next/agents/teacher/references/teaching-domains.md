# Teaching Domains

> teacher Agent가 다루는 교육 도메인

## Teacher가 처리하는 요청

| 카테고리 | 예시 |
|----------|------|
| **아키텍처 패턴** | "Repository 패턴이 뭐야?", "DDD 4-Layer 설명해줘" |
| **프레임워크/기술** | "React hooks가 뭐야?", "Server Components 설명해줘" |
| **개발 방법론** | "TDD가 뭐야?", "SDD 워크플로우 알려줘" |
| **팀 개발 규칙** | "Team Codex가 뭐야?", "커밋 컨벤션 알려줘" |
| **기술 비교** | "REST vs GraphQL 차이?", "SSR vs CSR 비교" |

## Teacher가 처리하지 않는 요청

| 요청 유형 | 올바른 Agent |
|-----------|-------------|
| "이 버그 뭐야?" (디버깅) | Orchestrator 직접 처리 |
| "Toast UI 구현해줘" (구현) | implementation-master |
| "A vs B 뭐가 좋아?" (기술 선택) | spike-master |
| "협업 프로세스 알려줘" (PO 영역) | SEMO-PO Teacher 참조 안내 |

## Domain 1: 아키텍처 패턴

```
🏗️ DDD 4-Layer Architecture
├── _repositories/    # 서버사이드 Supabase 데이터 접근
├── _api-clients/     # 브라우저 HTTP 통신 (Factory Pattern)
├── _hooks/           # React Query + 상태 관리
└── _components/      # 도메인 전용 UI
```

**핵심 패턴:**
- Repository Pattern - 데이터 접근 추상화
- API Client Factory - 환경별 백엔드 전환
- Custom Hooks - 비즈니스 로직 캡슐화

## Domain 2: 프레임워크/기술

```
⚛️ 기술 스택
├── Next.js App Router
├── React Server Components
├── React Query / TanStack Query
├── Supabase Integration
└── TypeScript
```

## Domain 3: 개발 방법론

```
🧪 개발 워크플로우
├── SDD (Spec-Driven Development) - Phase 1-3
├── ADD (Agent-Driven Development) - Phase 4
├── TDD (Test-Driven Development)
└── Constitution 9 Principles
```

## Domain 4: 팀 개발 규칙

> **SoT 참조**: 팀 규칙은 `semo-core/TEAM_RULES.md`에서 관리됩니다.

**로컬 참조**: `.claude/semo-core/TEAM_RULES.md`

**Wiki 참조** (보조):
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Git Rules](https://github.com/semicolon-devteam/docs/wiki/rules-git)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)

## Skill 활용 매핑

| Question About | Invoke Skill / Tool |
|----------------|---------------------|
| DDD 4-Layer 구조 | `skill:validate-architecture` |
| Supabase RPC/패턴 | `skill:fetch-supabase-example` |
| Supabase 스키마/테이블 | **Supabase MCP** (`mcp__supabase__*`) |
| 커밋/코드 품질 규칙 | `skill:check-team-codex` |
| Constitution 원칙 | `skill:constitution` |
