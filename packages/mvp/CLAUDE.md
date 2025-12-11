<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SEMO - Semicolon AI Transformation)

# SEMO-MVP Package Configuration

> MVP Developer를 위한 SEMO 패키지 - Next.js + Antigravity 통합

## Package Info

- **Package**: SEMO-MVP
- **Version**: [VERSION](./VERSION) 참조
- **Target**: Greenfield MVP projects using Antigravity
- **Audience**: MVP Developers in Semicolon ecosystem

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. Orchestrator-First

모든 요청은 의도 분석 후 적절한 Agent/Skill로 위임:

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}
[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

### 2. Schema Extension Strategy (우선순위 순)

| 우선순위 | 전략 | 조건 |
|---------|------|------|
| 1순위 | metadata JSONB 확장 | 기존 테이블에 데이터 추가 시 |
| 2순위 | 컬럼 추가 | metadata로 불가능하거나 쿼리 성능 필요 시 |
| 3순위 | 신규 테이블 생성 | 완전히 새로운 도메인/엔티티 필요 시 |

**metadata 확장 패턴** (1순위):
```sql
-- posts, comments 등 코어 테이블의 metadata 컬럼 활용
UPDATE posts SET metadata = metadata || '{"type": "office", "office_id": "uuid"}';

-- 쿼리
SELECT * FROM posts WHERE metadata->>'type' = 'office';
```

**컬럼/테이블 추가 시** (2-3순위):
- Flyway 마이그레이션 파일 작성 필수
- core-supabase 레포에 PR
- 네이밍 컨벤션 준수 (snake_case, MVP 접두사 권장)

### 3. Interface Compliance

```text
core-interface JSON artifacts → TypeScript types → domain/_types/
```

**필수 프로세스**:
1. `skill:sync-interface` 실행
2. 생성된 타입 import
3. 추가 필드는 별도 interface로 extends

### 4. Workflow Integration

```text
[semo-po] Epic/Task 생성
     ↓
[semo-mvp] Task Card 확인 → 구현 시작
     ↓
[semo-mvp] skill:verify-integration
     ↓
Community Solution Merge
```

---

## Quick Routing Table

| 의도 | 위임 대상 | 키워드 |
|------|----------|--------|
| 도메인 생성 | mvp-architect | 도메인, scaffold, 구조 |
| 구현 시작 | implementation-master | 구현, implement, 개발 |
| 타입 동기화 | skill:sync-interface | 타입, interface, 동기화 |
| Supabase 직접 | skill:supabase-fallback | supabase, graphql, fallback |
| UI 목업 | Antigravity 위임 | 목업, mockup, UI |
| 통합 검증 | skill:verify-integration | 검증, verify, 통합 |
| 온보딩 | onboarding-master | 온보딩, 시작, setup |
| 환경 검증 | skill:health-check | 환경, health, 검증 |

---

## Agents

| Agent | 역할 |
|-------|------|
| [orchestrator](agents/orchestrator/orchestrator.md) | MVP 작업 라우팅 및 의도 분석 |
| [mvp-architect](agents/mvp-architect/mvp-architect.md) | DDD 4-layer + metadata 패턴 설계 |
| [implementation-master](agents/implementation-master/implementation-master.md) | Phase-gated 구현 |
| [onboarding-master](agents/onboarding-master/onboarding-master.md) | MVP 개발자 온보딩 |

---

## Skills

| Skill | 역할 | 트리거 |
|-------|------|--------|
| [health-check](skills/health-check/SKILL.md) | 환경 및 MCP 검증 | `/SEMO:health` |
| [sync-interface](skills/sync-interface/SKILL.md) | core-interface 타입 동기화 | "타입 동기화" |
| [scaffold-mvp-domain](skills/scaffold-mvp-domain/SKILL.md) | 도메인 구조 생성 | `/SEMO:scaffold` |
| [supabase-fallback](skills/supabase-fallback/SKILL.md) | Supabase GraphQL 쿼리 | "supabase 직접" |
| [implement-mvp](skills/implement-mvp/SKILL.md) | MVP 구현 | `/SEMO:implement` |
| [verify-integration](skills/verify-integration/SKILL.md) | 통합 검증 | `/SEMO:verify` |

---

## Commands

| Command | 설명 |
|---------|------|
| `/SEMO:onboarding` | MVP 개발자 온보딩 |
| `/SEMO:health` | 환경 및 MCP 검증 |
| `/SEMO:scaffold` | 도메인 구조 생성 |
| `/SEMO:implement` | 구현 시작 |
| `/SEMO:mockup` | Antigravity 목업 위임 |
| `/SEMO:verify` | 통합 검증 |

---

## MCP Servers Required

| Server | 용도 | 검증 |
|--------|------|------|
| Context7 | 문서 검색 | `mcp_context7` 호출 |
| Sequential-thinking | 구조화된 추론 | `mcp_sequential_thinking` 호출 |
| TestSprite | 테스트 자동화 | `mcp_testsprite` 호출 |
| Supabase | 프로젝트 연동 | 프로젝트 목록 조회 |
| GitHub | Org/Repo 연동 | `semicolon-devteam` 접근 확인 |

---

## Antigravity Integration

| Tool | Purpose |
|------|---------|
| **Claude Code** | Logic, API integration, code generation |
| **Antigravity** | Visual mockups, browser testing, image generation |

### Recommended Workflow

```text
1. Claude Code → Task card 확인 → Domain 설계
2. Antigravity → /mockup → UI 목업 생성
3. Claude Code → 목업 기반 컴포넌트 구현
4. Antigravity → /browser-test → 시각적 검증
5. Claude Code → skill:verify-integration → 통합 준비
```

### Antigravity Context Injection

- `.agent/rules/`: SEMO 원칙, DDD 패턴, 스키마 확장 전략
- `.agent/workflows/`: mockup, component, browser-test

---

## DDD 4-Layer Architecture

```
app/{domain}/
├── _repositories/    # Layer 1: Supabase/GraphQL 쿼리 (server-side)
├── _api-clients/     # Layer 2: HTTP 통신 (browser)
├── _hooks/           # Layer 3: React Query + 상태관리
├── _components/      # Layer 4: 도메인 UI
├── _types/           # core-interface 타입
└── page.tsx
```

---

## References

- [SEMO Core Principles](../semo-core/PRINCIPLES.md)
- [core-interface](https://github.com/semicolon-devteam/core-interface)
- [core-supabase](https://github.com/semicolon-devteam/core-supabase)
- [Supabase GraphQL](https://supabase.com/docs/guides/graphql)
