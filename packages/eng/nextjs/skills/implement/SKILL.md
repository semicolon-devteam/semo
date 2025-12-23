---
name: implement
description: Execute ADD Phase 4 with phased development (v0.0.x → v0.4.x). Use when (1) specification docs are complete, (2) user requests feature implementation, (3) implementing DDD 4-layer with TDD and Supabase patterns.
tools: [Read, Write, Edit, Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: implement 실행` 시스템 메시지를 첫 줄에 출력하세요.

# Implement Skill

@./../_shared/development-workflow.md
@./../_shared/ddd-patterns.md
@./../_shared/test-templates.md
@./../_shared/commit-guide.md

**Purpose**: Orchestrate Agent-Driven Development (ADD) Phase 4 implementation workflow

## When to Use

- Specification (spec.md, plan.md, tasks.md) is complete
- User requests feature implementation
- Code needs to follow DDD 4-layer architecture

## Phase Overview

| Phase | Name | Key Action |
|-------|------|------------|
| v0.0.x | CONFIG | Dependencies, spike if needed |
| v0.1.x | PROJECT | Scaffold DDD 4-layer structure |
| v0.2.x | TESTS | TDD - Write tests FIRST |
| v0.3.x | DATA | Models, types, Supabase schema |
| v0.4.x | CODE | Implement all 4 layers |

## Usage

```javascript
skill: implement();
skill: implement({ resume: "v0.3.x" }); // Resume from phase
```

## Critical Rules

1. **Phase Discipline**: NEVER skip phases without agent approval
2. **TDD Enforcement**: v0.2.x (TESTS) MUST complete before v0.4.x (CODE)
3. **Supabase Patterns**: ALWAYS invoke `skill:fetch-supabase-example`
4. **DDD Compliance**: All 4 layers MUST be implemented
5. **Atomic Commits**: 작업 단위 최소화하여 중간중간 커밋
6. **Icon Pack Standard**: 아이콘은 표준 팩 사용 (아래 참조)

---

## 🔴 Icon Pack Standard (NON-NEGOTIABLE)

> **⚠️ SVG 인라인 작성 금지. 반드시 표준 아이콘 팩을 사용합니다.**

### 권장 아이콘 팩 (우선순위)

| 순위 | 패키지 | 설치 | 특징 |
|------|--------|------|------|
| 1 | **Lucide React** | `npm i lucide-react` | 트리쉐이킹 최적, 200+ 아이콘 |
| 2 | Heroicons | `npm i @heroicons/react` | Tailwind 공식, 24px/20px |
| 3 | React Icons | `npm i react-icons` | 멀티 팩 지원 (Feather, FA 등) |

### 기본: Lucide React

```tsx
// ✅ 올바른 사용
import { Search, Menu, X, ChevronDown } from 'lucide-react';

<Search className="w-5 h-5" />
<Menu className="w-6 h-6 text-gray-500" />
```

### 금지 패턴

```tsx
// ❌ SVG 인라인 작성 금지
<svg viewBox="0 0 24 24">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>

// ❌ 직접 path 작성 금지 (렌더링 버그 위험)
const Icon = () => <svg><path d="...복잡한 경로..."/></svg>;
```

### 프로젝트에 패키지 없을 시

```bash
# v0.0.x (CONFIG) 단계에서 설치
npm install lucide-react
```

### 아이콘 검색

- Lucide: https://lucide.dev/icons
- Heroicons: https://heroicons.com/
- React Icons: https://react-icons.github.io/react-icons/

## Dependencies

- `skill:fetch-supabase-example` - Fetch core-supabase patterns
- `skill:scaffold-domain` - Create DDD structure
- `skill:check-team-codex` - Validate code quality

## Related Skills

- `spec` - SDD Phase 1-3 specification
- `verify` - Phase 5 verification
- `spike` - Technical exploration

## References

- [Phase Workflow](references/phase-workflow.md) - Phase details, gate control, output format
