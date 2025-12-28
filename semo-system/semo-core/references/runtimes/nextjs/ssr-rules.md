# SSR-First Rules

> **Constitution Principle II**: SSR-First Development

## Server Component (Default)

```typescript
// ✅ CORRECT: Server Component (default)
export default async function PostsPage() {
  const repository = new PostsRepository();
  const posts = await repository.getPosts();
  return <PostsList posts={posts} />;
}

// ❌ WRONG: Unnecessary 'use client'
'use client';
export default function PostsPage() { }
```

## Client Component (Only When Needed)

```typescript
// ✅ CORRECT: Client component when needed
'use client';
export function PostsFilter() {
  const [filter, setFilter] = useState('');
  // Interactive logic
}
```

## When to Use Client Components

| Pattern | Server | Client |
|---------|--------|--------|
| Data fetching | ✅ | ❌ |
| Static rendering | ✅ | ❌ |
| Event handlers (onClick) | ❌ | ✅ |
| useState/useEffect | ❌ | ✅ |
| Browser APIs | ❌ | ✅ |
| React Query hooks | ❌ | ✅ |

## Remove Unnecessary 'use client'

```typescript
// Before (불필요한 use client)
'use client';
export function PostsHeader() {
  return <h1>Posts</h1>;
}

// After (Server Component)
export function PostsHeader() {
  return <h1>Posts</h1>;
}
```

## Import/Export Validation

```typescript
// ✅ CORRECT: Clean imports via index.ts
import { postsClient } from "@/app/posts/_api-clients";
import { usePosts } from "@/app/posts/_hooks";

// ❌ WRONG: Direct file imports
import { PostsApiClient } from "@/app/posts/_api-clients/posts.client";
```

## Validation Checklist

- [ ] Pages are Server Components by default
- [ ] `'use client'` only when necessary
- [ ] No event handlers in Server Components
- [ ] Client components minimized
- [ ] All layers export via `index.ts`
- [ ] External imports use barrel exports
- [ ] No circular dependencies
