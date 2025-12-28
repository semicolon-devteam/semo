# Layer Implementation

> ddd-architect Agent의 레이어별 상세 구현 가이드

## Step 1: Read Reference Implementation

Before implementing, analyze existing patterns:

```bash
# Read posts domain (gold standard)
cat app/posts/_repositories/PostsRepository.ts
cat app/posts/_api-clients/post.client.ts
cat app/posts/_hooks/usePosts.ts
cat app/posts/_components/PostsList.tsx
```

## Step 2: Create Domain Structure

```bash
# Create directory structure
mkdir -p app/{domain}/_repositories/__tests__
mkdir -p app/{domain}/_api-clients
mkdir -p app/{domain}/_hooks/__tests__
mkdir -p app/{domain}/_components/__tests__
```

## Layer 1: Repository (Server-side)

```typescript
// app/{domain}/_repositories/{Domain}Repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { GetItemsParams, GetItemsResponse } from '@/models/{domain}';

export class {Domain}Repository {
  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('{domain}_read', {
      p_limit: params.limit ?? 20,
      p_offset: params.offset ?? 0,
    });

    if (error) {
      throw new Error(`Failed to fetch {domain}: ${error.message}`);
    }

    return {
      items: data as unknown as ItemType[],
      total: data?.length ?? 0,
    };
  }
}
```

```typescript
// app/{domain}/_repositories/index.ts
export { {Domain}Repository } from './{Domain}Repository';
```

**Validation**:
- [ ] Uses `createServerSupabaseClient`
- [ ] Server-side only (no 'use client')
- [ ] Proper error handling
- [ ] Type-safe parameters and returns

---

## Layer 2: API Client (Browser-side)

```typescript
// app/{domain}/_api-clients/{domain}.client.ts
import { API_BASE } from '@/lib/api-clients/config';
import type { GetItemsParams, GetItemsResponse } from '@/models/{domain}';

export class {Domain}ApiClient {
  private baseUrl = `${API_BASE}/{domain}`;

  async getItems(params: GetItemsParams): Promise<GetItemsResponse> {
    const queryParams = new URLSearchParams({
      limit: params.limit?.toString() ?? '20',
      offset: params.offset?.toString() ?? '0',
    });

    const response = await fetch(`${this.baseUrl}?${queryParams}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch {domain}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Factory Pattern: Export singleton instance
export const {domain}Client = new {Domain}ApiClient();
```

```typescript
// app/{domain}/_api-clients/index.ts
export { {domain}Client } from './{domain}.client';
export type { {Domain}ApiClient } from './{domain}.client';
```

**Validation**:
- [ ] Follows Factory Pattern (singleton export)
- [ ] Uses API_BASE from config
- [ ] Proper error handling
- [ ] Query parameter serialization

**Global Export** (if needed across domains):
```typescript
// lib/api-clients/index.ts
export { {domain}Client } from '@/app/{domain}/_api-clients';
```

---

## Layer 3: Hooks (React Query)

```typescript
// app/{domain}/_hooks/use{Domain}.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';
import type { GetItemsParams } from '@/models/{domain}';

export function use{Domain}(params: GetItemsParams = {}) {
  return useQuery({
    queryKey: ['{domain}', params],
    queryFn: () => {domain}Client.getItems(params),
    staleTime: 60 * 1000, // 1 minute
  });
}
```

```typescript
// app/{domain}/_hooks/index.ts
export { use{Domain} } from './use{Domain}';
export { use{Domain}Mutation } from './use{Domain}Mutation';
```

**Validation**:
- [ ] 'use client' directive
- [ ] Uses React Query (useQuery/useMutation)
- [ ] Proper queryKey structure
- [ ] Stale time configured
- [ ] Calls API client from `_api-clients/`

---

## Layer 4: Components (UI)

**Component Pattern** (6 standard components):

```typescript
// app/{domain}/_components/index.ts
export { {Domain}Header } from './{Domain}Header';
export { {Domain}Filter } from './{Domain}Filter';
export { {Domain}List } from './{Domain}List';
export { {Domain}EmptyState } from './{Domain}EmptyState';
export { {Domain}LoadingState } from './{Domain}LoadingState';
export { {Domain}ErrorState } from './{Domain}ErrorState';
```

**Example Component**:
```typescript
// app/{domain}/_components/{Domain}List.tsx
'use client';

import { use{Domain} } from '../_hooks';
import { {Domain}Card } from './{Domain}Card';
import { {Domain}EmptyState } from './{Domain}EmptyState';
import { {Domain}LoadingState } from './{Domain}LoadingState';
import { {Domain}ErrorState } from './{Domain}ErrorState';

export function {Domain}List() {
  const { data, isLoading, error } = use{Domain}();

  if (isLoading) return <{Domain}LoadingState />;
  if (error) return <{Domain}ErrorState error={error} />;
  if (!data?.items.length) return <{Domain}EmptyState />;

  return (
    <div className="grid gap-4">
      {data.items.map((item) => (
        <{Domain}Card key={item.id} item={item} />
      ))}
    </div>
  );
}
```

**Validation**:
- [ ] Uses hooks from `_hooks/`
- [ ] Follows Atomic Design (uses atoms/molecules from `components/`)
- [ ] Proper loading/error/empty states
- [ ] TypeScript strict mode

---

## Step 4: Create Page

```typescript
// app/{domain}/page.tsx
import { {Domain}Header, {Domain}Filter, {Domain}List } from './_components';

export default function {Domain}Page() {
  return (
    <div className="container mx-auto py-6">
      <{Domain}Header />
      <{Domain}Filter />
      <{Domain}List />
    </div>
  );
}
```

---

## Step 5: Create API Route

```typescript
// app/api/{domain}/route.ts
import { NextRequest } from 'next/server';
import { {Domain}Repository } from '@/app/{domain}/_repositories';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const repository = new {Domain}Repository();
    const data = await repository.getItems({ limit, offset });

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## Step 6: Create Tests

**Repository Test**:
```typescript
// app/{domain}/_repositories/__tests__/{Domain}Repository.test.ts
import { {Domain}Repository } from '../{Domain}Repository';
import { createServerSupabaseClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

describe('{Domain}Repository', () => {
  it('should fetch items successfully', async () => {
    // Test implementation
  });
});
```

**Hook Test**:
```typescript
// app/{domain}/_hooks/__tests__/use{Domain}.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { use{Domain} } from '../use{Domain}';
import { {domain}Client } from '../../_api-clients';

jest.mock('../../_api-clients');

describe('use{Domain}', () => {
  it('should fetch items', async () => {
    // Test implementation
  });
});
```
