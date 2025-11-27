---
name: spec
description: Execute SDD Phase 1-3 workflow (specify → plan → tasks). Use when (1) starting new feature needing specification, (2) user requests spec creation, (3) need to create spec.md/plan.md/tasks.md before implementation.
tools: [Read, Write, Edit]
location: project
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: spec 호출 - {기능명}` 시스템 메시지를 첫 줄에 출력하세요.

# Spec Skill (Enhanced)

**Purpose**: Orchestrate complete Spec-Driven Development (SDD) Phase 1-3 workflow

## When to Use

- Starting a new feature that needs specification
- User requests feature documentation
- Requirement gathering is needed before implementation
- SDD workflow must be followed (Constitution Principle VIII)

## Phase Flow

```
specify → clarify? → plan → checklist? → tasks → issues? → report
```

| Phase | Command | Output | Optional |
|-------|---------|--------|----------|
| 1 | `/speckit.specify` | spec.md | - |
| 2 | `/speckit.clarify` | spec.md (updated) | Auto |
| 3 | `/speckit.plan` | plan.md | - |
| 4 | `/speckit.checklist` | checklist.md | Ask |
| 5 | `/speckit.tasks` | tasks.md | - |
| 6 | `skill:create-issues` | GitHub Issues | Ask |

## Usage

```javascript
skill: spec("Add real-time notifications for post comments");
```

## Constitution Compliance

- **Principle VIII**: Spec-Driven Development (NON-NEGOTIABLE)
- Ensures WHAT and WHY documented before HOW
- Creates single source of truth for features

## Related Skills

- `implement` - ADD Phase 4 implementation
- `verify` - Phase 5 verification
- `create-issues` - GitHub Issues automation

## References

For detailed documentation, see:

- [Phase Details](references/phase-details.md) - Phase 1-7 상세, configuration options
- [Output Format](references/output-format.md) - Completion report, dependencies, success criteria
