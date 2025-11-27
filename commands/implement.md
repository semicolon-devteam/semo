# Implement Feature Command

Implement a new feature following Semicolon's DDD architecture and Spec-Driven Development workflow.

## Prerequisites Check:

1. Read CLAUDE.md for current architecture status
2. Verify domain structure exists in `app/{domain}/`
3. Check Team Codex conventions: https://github.com/semicolon-devteam/docs/wiki/Team-Codex
4. Check if spec exists in `specs/{domain}/spec.md` (SDD workflow)

## SDD Workflow (if starting from scratch):

1. **Specification** (`/specify`):
   - Create `specs/{domain}/spec.md`
   - Define user scenarios and acceptance criteria

2. **Planning** (`/plan`):
   - Create `specs/{domain}/plan.md`
   - Technical approach and DDD mapping

3. **Task Breakdown** (`/tasks`):
   - Create `specs/{domain}/tasks.md`
   - Actionable work items

## Implementation Layers (in order):

### 1. Repository Layer (`_repositories/`)
**Purpose**: Server-side Supabase data access

```typescript
// app/{domain}/_repositories/{Domain}Repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class {Domain}Repository {
  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const supabase = await createServerSupabaseClient();
    // Implementation following core-supabase patterns
  }
}
```

**Checklist**:
- [ ] Uses `createServerSupabaseClient`
- [ ] RPC functions from core-supabase
- [ ] Proper error handling
- [ ] Type-safe parameters and returns
- [ ] Unit tests in `__tests__/`

### 2. API Client Layer (`_api-clients/`)
**Purpose**: Browser-side HTTP communication

```typescript
// app/{domain}/_api-clients/{domain}.client.ts
import { API_BASE } from '@/lib/api-clients/config';

export class {Domain}ApiClient {
  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const response = await fetch(`${API_BASE}/{domain}?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error('Failed to fetch items');
    return response.json();
  }
}

// Factory Pattern export
export const {domain}Client = new {Domain}ApiClient();
```

**Checklist**:
- [ ] Follows Factory Pattern
- [ ] Exported as singleton instance
- [ ] Proper error handling
- [ ] Added to `lib/api-clients/index.ts` for global access

### 3. Hooks Layer (`_hooks/`)
**Purpose**: React Query + state management

```typescript
// app/{domain}/_hooks/use{Domain}.ts
import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function use{Domain}(params: GetItemsParams) {
  return useQuery({
    queryKey: ['{domain}', params],
    queryFn: () => {domain}Client.getItems(params),
    staleTime: 60 * 1000, // 1 minute
  });
}
```

**Checklist**:
- [ ] Uses React Query (useQuery/useMutation)
- [ ] Proper queryKey structure
- [ ] Stale time configured
- [ ] Error and loading states exposed
- [ ] Unit tests with mock API clients

### 4. Components Layer (`_components/`)
**Purpose**: Domain-specific UI components

**Component Patterns**:
- `{Domain}Header`: Page header with title and actions
- `{Domain}Filter`: Filter controls
- `{Domain}List`: Main list/grid display
- `{Domain}EmptyState`: Empty state UI
- `{Domain}LoadingState`: Loading skeletons
- `{Domain}ErrorState`: Error display

```typescript
// app/{domain}/_components/index.ts
export { {Domain}Header } from './{Domain}Header';
export { {Domain}Filter } from './{Domain}Filter';
export { {Domain}List } from './{Domain}List';
export { {Domain}EmptyState } from './{Domain}EmptyState';
export { {Domain}LoadingState } from './{Domain}LoadingState';
export { {Domain}ErrorState } from './{Domain}ErrorState';
```

**Checklist**:
- [ ] All 6 component types created
- [ ] Uses hooks from `_hooks/`
- [ ] Follows Atomic Design (uses atoms/molecules)
- [ ] Proper TypeScript types
- [ ] Component tests

## Reference Implementations:

Check existing domains for patterns:
- **posts**: Complete DDD implementation (gold standard)
- **dashboard**: Activity features with proper layering
- **profile**: CRUD operations example

Read these files:
- `app/posts/_repositories/PostsRepository.ts`
- `app/posts/_api-clients/post.client.ts`
- `app/posts/_hooks/usePosts.ts`
- `app/posts/_components/PostsList.tsx`

## Validation Steps:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint check
npm run lint

# 3. Run tests
npm test -- app/{domain}

# 4. Build check
npm run build
```

## Team Codex Compliance:

- [ ] No debug code (console.log, debugger)
- [ ] ESLint passes
- [ ] TypeScript strict mode
- [ ] Proper commit message: `feat({domain}): Add {feature}`

## Implementation Order:

1. Create directory structure (`app/{domain}/_repositories`, etc.)
2. Implement Repository (server-side)
3. Create API Route (`app/api/{domain}/route.ts`)
4. Implement API Client (browser-side)
5. Create Hooks (React Query)
6. Build Components (UI)
7. Create Page (`app/{domain}/page.tsx`)
8. Write Tests for each layer
9. Validate quality gates

Ask the user which domain and feature they want to implement, then guide them through this workflow systematically.
