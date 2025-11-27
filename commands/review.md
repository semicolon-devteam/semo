# Code Review Command

Review code against Semicolon team standards and best practices.

## Review Process:

### 1. Team Codex Compliance

**Reference**: https://github.com/semicolon-devteam/docs/wiki/Team-Codex

#### Git & Commit Convention:
```bash
# Check recent commit messages
git log -5 --oneline
```

**Expected Format**: `type(scope): subject`
- Types: feat, fix, docs, test, refactor, style, chore
- Examples:
  - ✅ `feat(posts): Add comment functionality`
  - ✅ `fix(auth): Resolve login redirect issue`
  - ❌ `updated code`
  - ❌ `fixes`

#### Code Quality Rules:
```bash
# 1. ESLint check
npm run lint

# 2. TypeScript check
npx tsc --noEmit

# 3. Debug code detection
grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules

# 4. Pre-commit hook bypass check
git log -1 --format="%B" | grep -i "no-verify"
```

**Violations**:
- [ ] No console.log statements (except in error handlers)
- [ ] No debugger statements
- [ ] No commented-out code blocks
- [ ] No `--no-verify` flag usage

### 2. DDD Architecture Compliance

**Reference**: Read CLAUDE.md DDD Architecture section

#### Domain Structure:
```
app/{domain}/
├── _repositories/     ✅ Server-side data access
├── _api-clients/      ✅ Browser HTTP client
├── _hooks/            ✅ React Query + state
├── _components/       ✅ Domain-specific UI
└── page.tsx           ✅ Route handler
```

**Checklist**:
- [ ] All 4 layers implemented (Repository → API Client → Hooks → Components)
- [ ] Repository uses `createServerSupabaseClient`
- [ ] API Client follows Factory Pattern (singleton export)
- [ ] Hooks use React Query properly
- [ ] Components import from domain `_hooks/`, not global hooks
- [ ] Each layer has index.ts for clean exports
- [ ] Tests exist for each layer

#### Anti-Patterns to Flag:
❌ Client component in Repository layer
❌ Direct Supabase import in components
❌ Business logic in UI components
❌ Missing index exports
❌ Cross-domain dependencies (posts importing from dashboard)

### 3. Supabase Integration

**Reference**: https://github.com/semicolon-devteam/docs/wiki/guides-architecture-supabase-interaction

#### Pattern Verification:
```typescript
// ✅ Correct Pattern
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabase = await createServerSupabaseClient();
const { data, error } = await supabase.rpc('posts_read', params);

// ❌ Wrong Patterns
import { createClient } from '@supabase/supabase-js'; // Don't import directly
const supabase = createClient(...); // Use our wrapper
```

**Checklist**:
- [ ] Uses `createServerSupabaseClient` in repositories
- [ ] RPC function names match core-supabase examples
- [ ] Parameter structure follows core-supabase patterns
- [ ] Type assertions: `as unknown as Type` for jsonb returns
- [ ] Error handling implemented
- [ ] No direct `@supabase/supabase-js` imports in components

#### Core-Supabase Example Comparison:

For each Supabase operation, verify against core-supabase:
```bash
# Fetch example from core-supabase
gh api repos/semicolon-devteam/core-supabase/contents/document/test/{domain}/{operation}.ts \
  --jq '.content' | base64 -d
```

### 4. Testing Coverage

**Checklist**:
- [ ] Repository tests: Mock Supabase client, test error handling
- [ ] Hook tests: Mock API client, test loading/error states
- [ ] Component tests: Mock hooks, test UI rendering
- [ ] Test file naming: `{Component}.test.tsx` or in `__tests__/`

```bash
# Run tests
npm test

# Check coverage
npm run test:coverage
```

**Expected Coverage**:
- Repositories: > 80%
- Hooks: > 80%
- Components: > 70%

### 5. TypeScript & Type Safety

**Checklist**:
- [ ] No `any` types (use `unknown` instead)
- [ ] Proper interface/type definitions in `models/`
- [ ] Generic types for reusable functions
- [ ] Strict null checks enabled
- [ ] No type assertions without justification

```bash
# Type check
npx tsc --noEmit
```

### 6. Performance & Best Practices

**Checklist**:
- [ ] Server Components used by default (no `'use client'` unless needed)
- [ ] Dynamic imports for heavy components
- [ ] React Query staleTime configured (not default 0)
- [ ] Proper loading states (skeletons, not just spinners)
- [ ] Error boundaries implemented
- [ ] Image optimization (next/image)

### 7. Accessibility

**Checklist**:
- [ ] Semantic HTML elements
- [ ] ARIA labels where needed
- [ ] Keyboard navigation support
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

### 8. Security

**Checklist**:
- [ ] No hardcoded secrets or API keys
- [ ] Environment variables properly used
- [ ] RLS (Row Level Security) enabled in Supabase
- [ ] User input sanitized
- [ ] No SQL injection vulnerabilities

## Review Output Format:

```markdown
## Code Review Results

### ✅ Strengths:
- [List positive aspects]

### ❌ Critical Issues:
- [Issues that must be fixed]

### ⚠️ Warnings:
- [Issues that should be fixed]

### 💡 Suggestions:
- [Nice-to-have improvements]

### 📊 Metrics:
- ESLint: ✅/❌
- TypeScript: ✅/❌
- Tests: ✅/❌ (X/Y passing)
- Coverage: XX%

### 🔗 References:
- [Link to relevant Team Codex section]
- [Link to example implementation]
```

## Severity Levels:

- **🔴 Critical**: Breaks functionality, security issues, violates Team Codex
- **🟡 Warning**: Code smells, missing tests, minor convention violations
- **🟢 Suggestion**: Performance optimizations, better patterns available

## Quick Review Checklist:

```bash
# Run all quality checks
npm run lint && \
npx tsc --noEmit && \
npm test && \
git log -5 --oneline
```

Expected: All green ✅

Provide specific, actionable feedback with code examples and links to documentation.
