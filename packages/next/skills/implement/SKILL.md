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
