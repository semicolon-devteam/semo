# Team Codex Core Rules

## 1. Git & Commit Convention

**Format**: `type(scope): subject`

**Valid Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `style`: Code formatting (not CSS)
- `chore`: Build process, dependencies, tooling

**Rules**:
- Scope must be present (domain, feature, or component)
- Subject must be concise (< 72 characters)
- Use imperative mood ("Add feature" not "Added feature")
- No period at the end

**Examples**:
- ✅ `feat(posts): Add comment functionality`
- ✅ `fix(auth): Resolve login redirect issue`
- ✅ `test(v0.2.x): Add repository unit tests`
- ✅ `docs(readme): Update installation instructions`
- ❌ `updated code`
- ❌ `fixes` (no scope)
- ❌ `feat: added new feature.` (period at end)

## 2. Code Quality Rules

**Mandatory**:
- No `console.log` (except in error handlers or logging utilities)
- No `debugger` statements
- No commented-out code blocks
- ESLint must pass
- TypeScript must pass (no errors)
- All tests must pass
- No `--no-verify` flag usage (bypassing pre-commit hooks)

**Type Safety**:
- No `any` types (use `unknown` instead)
- Strict null checks
- Proper type definitions in `models/`

**Import Standards**:
- Modular imports for large libraries
- No wildcard imports (`import *`)
- Absolute imports with `@/` alias

## 3. Development Standards

**DDD Architecture**:
- Repository in `app/{domain}/_repositories/`
- API Client in `app/{domain}/_api-clients/`
- Hooks in `app/{domain}/_hooks/`
- Components in `app/{domain}/_components/`

**Testing**:
- Unit tests for repositories
- Integration tests for hooks
- Component tests for UI
- Minimum coverage: 70%

**Performance**:
- Server Components by default
- `'use client'` only when necessary
- React Query staleTime configured
- Dynamic imports for heavy components
