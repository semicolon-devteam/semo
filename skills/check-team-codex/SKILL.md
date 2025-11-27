---
name: check-team-codex
description: Validate code against Team Codex standards. Use when (1) before creating commits, (2) during verification phase, (3) quality gate enforcement, (4) checking commit format/ESLint/TypeScript/debug code compliance.
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: check-team-codex 호출 - {검증 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# Check Team Codex Skill

**Purpose**: Enforce Semicolon team coding standards and conventions

## When to Use

Agents should invoke this skill when:

- Before creating commits
- During verification phase
- After implementation completion
- Pre-commit validation needed
- Quality gates in v0.4.x CODE phase

## Quick Start

### Check Commands

```bash
# 1. Commit messages
git log --oneline -10

# 2. ESLint
npm run lint

# 3. TypeScript
npx tsc --noEmit

# 4. Debug code
grep -r "console\.log" src/
grep -r "debugger" src/

# 5. 'any' types
grep -r ":\s*any" src/
grep -r "as any" src/
```

## Usage

```javascript
// Full check (all validations)
skill: checkTeamCodex();

// Specific checks
skill: checkTeamCodex({ checks: ["commits", "eslint", "typescript"] });

// Quick check (ESLint + TypeScript only)
skill: checkTeamCodex({ quick: true });
```

## Severity Levels

| Level | Items | Action |
|-------|-------|--------|
| 🔴 **CRITICAL** | ESLint/TypeScript errors, hook bypass, architecture violations | Blocks PR |
| 🟡 **WARNING** | Debug code, 'any' types, TODO comments | Should fix |
| 🟢 **INFO** | Style suggestions, performance hints | Nice to have |

## Critical Rules

1. **Zero Tolerance for ESLint/TypeScript Errors**
2. **No Debug Code in Commits**: Always clean before commit
3. **Never Bypass Pre-commit Hooks**: Fix errors, don't skip
4. **Explicit Types**: Avoid 'any', use proper typing
5. **Commit Format**: MUST follow type(scope): subject

## Dependencies

- `npm run lint` - ESLint
- `npx tsc --noEmit` - TypeScript
- `git log` - Commit history
- `grep` - Code pattern search

## Related Skills

- `verify` - Uses this skill for comprehensive verification
- `implement` - Uses this skill in v0.4.x CODE phase

## References

For detailed documentation, see:

- [Check Items](references/check-items.md) - All 7 check categories with commands
- [Output Format](references/output-format.md) - Report templates, return values, quick fixes
