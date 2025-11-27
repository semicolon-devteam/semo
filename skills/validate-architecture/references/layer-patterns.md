# Layer Patterns

## DDD 4-Layer Structure

```bash
# Check each domain has all 4 layers
app/{domain}/
├── _repositories/      ✓ Must exist
├── _api-clients/       ✓ Must exist
├── _hooks/             ✓ Must exist
└── _components/        ✓ Must exist
```

Validates:

- All 4 directories exist
- Each has `__tests__/` subdirectory (except api-clients)
- Each has `index.ts` export file
- Proper naming conventions (`_` prefix for private)

## Repository Layer Rules

```typescript
// ✅ CORRECT
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class PostsRepository {
  async getPosts() {
    const supabase = await createServerSupabaseClient();
    // ...
  }
}

// ❌ WRONG: No 'use client'
("use client");
export class PostsRepository {}

// ❌ WRONG: No browser Supabase client
import { createBrowserClient } from "@/lib/supabase/client";
```

Checks:

- No `'use client'` directive
- Uses `createServerSupabaseClient`
- No browser-only APIs (localStorage, window, etc.)
- Proper error handling

## API Client Layer Rules

```typescript
// ✅ CORRECT: Factory Pattern
export const postsClient = new PostsApiClient();

// ✅ CORRECT: Singleton export
export { postsClient } from "@/app/posts/_api-clients";

// ❌ WRONG: No singleton
export class PostsApiClient {} // Missing singleton export
```

Checks:

- Factory Pattern implemented
- Singleton instance exported
- Registered in `lib/api-clients/index.ts`
- No Supabase direct access

## Hooks Layer Rules

```typescript
// ✅ CORRECT
import { useQuery } from "@tanstack/react-query";
import { postsClient } from "../_api-clients";

export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: () => postsClient.getPosts(),
  });
}

// ❌ WRONG: Direct Supabase access
import { createBrowserClient } from "@/lib/supabase/client";

// ❌ WRONG: Direct fetch
const response = await fetch("/api/posts");
```

Checks:

- Uses React Query (useQuery/useMutation)
- Calls API client (not direct fetch)
- No Supabase direct access
- Proper queryKey structure

## Components Layer Rules

```typescript
// ✅ CORRECT
import { usePosts } from "../_hooks";

export function PostsList() {
  const { data } = usePosts();
  // ...
}

// ❌ WRONG: Direct API client access
import { postsClient } from "../_api-clients";

// ❌ WRONG: Direct Supabase access
import { createBrowserClient } from "@/lib/supabase/client";
```

Checks:

- Uses hooks (not API clients directly)
- No Supabase direct access
- No business logic (only UI)
- Follows Atomic Design for shared components

## Test Structure

```text
app/{domain}/
├── _repositories/__tests__/
│   └── {Domain}Repository.test.ts    ✓ Must exist
├── _hooks/__tests__/
│   └── use{Domain}s.test.ts          ✓ Must exist
└── _components/__tests__/
    └── {Domain}Header.test.tsx       ✓ Must exist
```

Checks:

- Test files exist for each layer
- Test files follow naming convention
- Proper test structure (describe, it, expect)
