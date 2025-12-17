# Verification Steps

> quality-master Agent의 상세 검증 단계
>
> **SoT 참조**: Team Codex 규칙은 `semo-core/TEAM_RULES.md`에서 관리됩니다.

## Step 1: Spec Compliance (speckit.analyze)

```bash
/speckit.analyze
```

**What speckit.analyze does**:

- Cross-artifact consistency check
- Validates spec.md ↔ plan.md ↔ tasks.md alignment
- Identifies underspecified areas
- Reports specification quality

**Parse results**:

```markdown
## Spec Compliance Results

**Consistency Check**:

- spec.md ↔ plan.md: [✅/⚠️/❌]
- plan.md ↔ tasks.md: [✅/⚠️/❌]
- Acceptance Criteria coverage: [%]

**Issues Found**: [count]
[List issues if any]

**Recommendation**:
[✅ Proceed] or [⚠️ Fix issues first]
```

## Step 2: Team Codex Compliance

### 2.1 Commit Message Validation

```bash
# Check last 10 commits
git log -10 --oneline --format="%s"
```

**Validate format**: `type(scope): subject`

**Valid types**: feat, fix, docs, test, refactor, style, chore

**Check**:

```markdown
## Commit Messages

Recent commits (last 10):
[List commits with ✅/❌ indicator]

**Issues**:

- ❌ Commit X: Missing scope
- ❌ Commit Y: Invalid type

**Pass**: [X/10] commits valid
```

### 2.2 Code Quality Checks

```bash
# ESLint
npm run lint

# TypeScript
npx tsc --noEmit

# Debug code detection
grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules --exclude="*.test.*"

# 'any' type detection
grep -r ": any\|as any" src/ --exclude-dir=node_modules --exclude="*.test.*"
```

**Report**:

```markdown
## Code Quality

**ESLint**: [✅ 0 errors, 0 warnings] or [❌ X errors, Y warnings]
**TypeScript**: [✅ No errors] or [❌ X errors]
**Debug Code**: [✅ Clean] or [⚠️ Found X instances]
**'any' Types**: [✅ None found] or [⚠️ Found X instances]
```

### 2.3 Pre-commit Hook Compliance

```bash
# Check for --no-verify usage
git log --all --grep="--no-verify\|-n " --oneline
```

**Critical**: If `--no-verify` found, this is a **CRITICAL VIOLATION**.

## Step 3: DDD Architecture Compliance

### 3.1 Domain Structure Verification

```bash
# Check domain has all 4 layers
for domain in app/*/; do
  echo "Checking $domain"
  ls -la "$domain" | grep -E "(_repositories|_api-clients|_hooks|_components)"
done
```

**Validate**:

```markdown
## DDD Architecture

**Domain**: {domain}

Layers:

- \_repositories/: [✅/❌]
  - **tests**/: [✅/❌]
  - index.ts: [✅/❌]
- \_api-clients/: [✅/❌]
  - index.ts: [✅/❌]
- \_hooks/: [✅/❌]
  - **tests**/: [✅/❌]
  - index.ts: [✅/❌]
- \_components/: [✅/❌]
  - **tests**/: [✅/❌]
  - index.ts: [✅/❌]

**Issues**: [List if any]
```

### 3.2 Layer Pattern Compliance

```bash
# Check for violations
grep -r "'use client'" app/*/_repositories/  # Should be empty
grep -r "createServerSupabaseClient" app/*/_components/  # Should be empty
grep -r "@supabase/supabase-js" src/  # Should be empty (use wrappers)
```

**Report violations**:

```markdown
## Architecture Violations

**Server Code in Client Components**:
[List files if found]

**Client Directives in Repositories**:
[List files if found]

**Direct Supabase Imports**:
[List files if found]

**Status**: [✅ No violations] or [❌ X violations found]
```

## Step 4: Supabase Pattern Verification

For each Repository file:

```bash
# Find all Repository files
find app -name "*Repository.ts" -not -path "*/node_modules/*"
```

For each file, verify:

1. Uses `createServerSupabaseClient` from `@/lib/supabase/server`
2. RPC function names follow core-supabase patterns
3. Type assertions use `as unknown as Type`
4. Error handling implemented

**Report**:

```markdown
## Supabase Integration

**Repository Files Checked**: [count]

**Pattern Compliance**:

- Server client usage: [✅/❌]
- RPC function patterns: [✅/❌]
- Type assertions: [✅/❌]
- Error handling: [✅/❌]

**Issues**: [List if any]

**Recommendation**: [Compare with core-supabase examples if issues found]
```

## Step 5: Test Coverage and Quality

```bash
# Run all tests
npm test

# Generate coverage report
npm run test:coverage
```

**Analyze**:

```markdown
## Testing

**Test Execution**:

- Total tests: X
- Passing: Y
- Failing: Z
- Pass rate: Y/X (%)

**Coverage**:

- Overall: [%]
- Repositories: [%] (target: >80%)
- Hooks: [%] (target: >80%)
- Components: [%] (target: >70%)

**Quality**:

- Repository tests mock Supabase: [✅/❌]
- Hook tests mock API clients: [✅/❌]
- Component tests mock hooks: [✅/❌]

**Status**: [✅ Meets coverage targets] or [⚠️ Below targets]
```

## Step 6: Constitution Principles Validation

Read `.specify/memory/constitution.md` and validate each principle:

```markdown
## Constitution Compliance

### I. DDD Architecture (NON-NEGOTIABLE)

[✅/❌] All 4 layers implemented
[✅/❌] Domain boundaries clear
[✅/❌] Spring Boot alignment

### II. SSR-First Development

[✅/❌] Server Components by default
[✅/❌] Justified 'use client' directives
[✅/❌] Server Actions for mutations

### III. Test-Driven Quality (NON-NEGOTIABLE)

[✅/❌] Tests written before implementation (v0.2.x → v0.4.x)
[✅/❌] Coverage > 80% for new code
[✅/❌] All tests passing

### IV. Performance Excellence

[✅/❌] Bundle size < 500KB
[✅/❌] Dynamic imports for heavy components

### V. API Mode Flexibility

[✅/❌] Factory Pattern for API clients
[✅/❌] Environment-based switching
[✅/❌] 1-Hop Rule enforced

### VI. Atomic Design System

[✅/❌] UI components follow hierarchy
[✅/❌] No business logic in Atoms/Molecules

### VII. Type Safety

[✅/❌] Explicit return types
[✅/❌] No 'any' types
[✅/❌] Database types generated

### VIII. Spec-Driven Development

[✅/❌] spec.md exists and complete
[✅/❌] plan.md exists and aligned
[✅/❌] tasks.md exists and followed

### IX. Agent-Driven Collaboration

[✅/❌] Feature branch used
[✅/❌] Commits grouped by phase
[✅/❌] Decisions documented

**Overall Compliance**: [X/9 principles satisfied]
```
