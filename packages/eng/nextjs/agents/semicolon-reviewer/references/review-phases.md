# Review Phases

> semicolon-reviewer Agent의 상세 리뷰 단계

## Phase 1: Team Codex Compliance

**Reference**: https://github.com/semicolon-devteam/docs/wiki/Team-Codex

### 1.1 Git & Commit Convention

```bash
# Check recent commits
git log -10 --oneline
```

**Expected Format**: `type(scope): subject`

**Valid Types**: feat, fix, docs, test, refactor, style, chore

**Examples**:
- ✅ `feat(posts): Add comment functionality`
- ✅ `fix(auth): Resolve login redirect issue`
- ❌ `updated code`
- ❌ `WIP`

**Check**:
- [ ] All commits follow convention
- [ ] Scope matches domain/feature
- [ ] Subject is clear and descriptive

### 1.2 Code Quality

```bash
# Run quality checks
npm run lint
npx tsc --noEmit
```

**Critical Violations**:
- ❌ Debug code: `console.log`, `debugger`
- ❌ Commented-out code blocks
- ❌ ESLint errors
- ❌ TypeScript errors
- ❌ `--no-verify` flag usage

**Search for violations**:
```bash
# Debug code
grep -r "console\.log\|debugger" src/ --exclude-dir=node_modules

# Pre-commit bypass
git log --all --grep="--no-verify" --oneline
```

## Phase 2: DDD Architecture Compliance

### 2.1 Domain Structure

```
app/{domain}/
├── _repositories/     ✅ Server-side data access
├── _api-clients/      ✅ Browser HTTP client
├── _hooks/            ✅ React Query + state
├── _components/       ✅ Domain-specific UI
└── page.tsx           ✅ Route handler
```

**Verify Structure**:
```bash
ls -la app/{domain}/
```

**Check**:
- [ ] All 4 layers exist
- [ ] Underscore prefix for layer directories
- [ ] Index exports for each layer
- [ ] Tests exist for each layer

### 2.2 Layer Compliance

**Repository Layer**:
```typescript
// ✅ Correct
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class {Domain}Repository {
  async getItems() {
    const supabase = await createServerSupabaseClient();
    // ...
  }
}
```

**Violations**:
- ❌ 'use client' in repository
- ❌ Direct Supabase import
- ❌ Business logic in components

```bash
# Repository violations
grep -r "'use client'" app/*/_repositories/

# Component violations
grep -r "createServerSupabaseClient" app/*/_components/
```

## Phase 3: Supabase Integration

### 3.1 Client Usage

```typescript
// ✅ Server-side (Repositories)
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ✅ Client-side (if needed)
import { createBrowserClient } from '@/lib/supabase/client';

// ❌ Wrong
import { createClient } from '@supabase/supabase-js';
```

### 3.2 RPC Pattern Compliance

**Fetch core-supabase example**:
```bash
gh api repos/semicolon-devteam/core-supabase/contents/document/test/{domain}/{operation}.ts \
  --jq '.content' | base64 -d
```

**Compare Implementation**:
- [ ] RPC function name matches
- [ ] Parameter structure matches
- [ ] Type assertions follow pattern

### 3.3 Type Safety

```typescript
// ✅ Correct
const data = result.data as unknown as PostType[];

// ❌ Wrong
const data = result.data as any;
```

## Phase 4: Testing Coverage

```bash
npm test
npm run test:coverage
```

**Expected Coverage**:
- Repositories: > 80%
- Hooks: > 80%
- Components: > 70%

**Check**:
- [ ] Repository tests mock Supabase
- [ ] Hook tests mock API client
- [ ] Component tests mock hooks
- [ ] All tests passing

## Phase 5: Performance & Best Practices

### 5.1 Server Components

```typescript
// ✅ Default: Server Component (no directive)
export default function Page() {
  return <div>Server Component</div>;
}

// ✅ Client Component (when needed)
'use client';
export function InteractiveComponent() {
  const [state, setState] = useState();
  return <div>Client Component</div>;
}
```

### 5.2 React Query Configuration

```typescript
// ✅ Proper staleTime
useQuery({
  queryKey: ['posts'],
  queryFn: () => postsClient.getPosts(),
  staleTime: 60 * 1000, // 1 minute
});
```

## Phase 6: Security & Accessibility

### 6.1 Security

- [ ] No hardcoded secrets
- [ ] Environment variables properly used
- [ ] No sensitive data in logs
- [ ] RLS enabled in Supabase

### 6.2 Accessibility

- [ ] Semantic HTML elements
- [ ] ARIA labels where needed
- [ ] Keyboard navigation support
- [ ] Color contrast (WCAG AA)
