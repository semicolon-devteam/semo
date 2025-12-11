# Code Patterns

> ddd-architect Agent의 코드 패턴 가이드

## CRUD Operations

| Operation | Method | Layer |
|-----------|--------|-------|
| Read | `getItems()` | Repository |
| Create | `createItem()` | Repository |
| Update | `updateItem()` | Repository |
| Delete | `deleteItem()` | Repository |

## Hook Patterns

| Pattern | Hook Type | Usage |
|---------|-----------|-------|
| List Query | `useQuery` | Fetch list with filters |
| Single Query | `useQuery` | Fetch single item |
| Create | `useMutation` | Create new item |
| Update | `useMutation` | Update existing item |
| Delete | `useMutation` | Delete item |

## Repository Pattern Examples

### Basic Read Operation

```typescript
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
```

### Create Operation

```typescript
async createItem(item: CreateItemParams): Promise<ItemType> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('{domain}_create', {
    p_title: item.title,
    p_content: item.content,
  });

  if (error) {
    throw new Error(`Failed to create {domain}: ${error.message}`);
  }

  return data as unknown as ItemType;
}
```

### Update Operation

```typescript
async updateItem(id: string, updates: UpdateItemParams): Promise<ItemType> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('{domain}_update', {
    p_id: id,
    p_title: updates.title,
    p_content: updates.content,
  });

  if (error) {
    throw new Error(`Failed to update {domain}: ${error.message}`);
  }

  return data as unknown as ItemType;
}
```

### Delete Operation

```typescript
async deleteItem(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc('{domain}_delete', {
    p_id: id,
  });

  if (error) {
    throw new Error(`Failed to delete {domain}: ${error.message}`);
  }
}
```

## Hook Pattern Examples

### Query Hook

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function use{Domain}(params: GetItemsParams = {}) {
  return useQuery({
    queryKey: ['{domain}', params],
    queryFn: () => {domain}Client.getItems(params),
    staleTime: 60 * 1000,
  });
}
```

### Single Item Query Hook

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function use{Domain}Item(id: string) {
  return useQuery({
    queryKey: ['{domain}', id],
    queryFn: () => {domain}Client.getItem(id),
    enabled: !!id,
  });
}
```

### Mutation Hook

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function useCreate{Domain}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: CreateItemParams) => {domain}Client.createItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['{domain}'] });
    },
  });
}
```

### Update Mutation Hook

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function useUpdate{Domain}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: UpdateItemParams & { id: string }) =>
      {domain}Client.updateItem(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['{domain}', id] });
      queryClient.invalidateQueries({ queryKey: ['{domain}'] });
    },
  });
}
```

### Delete Mutation Hook

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function useDelete{Domain}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {domain}Client.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['{domain}'] });
    },
  });
}
```

## Component Pattern Examples

### List Component

```typescript
'use client';

import { use{Domain} } from '../_hooks';

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

### Form Component with Mutation

```typescript
'use client';

import { useCreate{Domain} } from '../_hooks';
import { useState } from 'react';

export function {Domain}Form() {
  const [title, setTitle] = useState('');
  const { mutate, isPending } = useCreate{Domain}();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ title });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

## Testing Patterns

### Repository Test

```typescript
import { {Domain}Repository } from '../{Domain}Repository';
import { createServerSupabaseClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

const mockSupabase = {
  rpc: jest.fn(),
};

(createServerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase);

describe('{Domain}Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch items successfully', async () => {
    const mockData = [{ id: '1', title: 'Test' }];
    mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const repository = new {Domain}Repository();
    const result = await repository.getItems({ limit: 10 });

    expect(result.items).toEqual(mockData);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('{domain}_read', {
      p_limit: 10,
      p_offset: 0,
    });
  });
});
```

### Hook Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { use{Domain} } from '../use{Domain}';
import { {domain}Client } from '../../_api-clients';

jest.mock('../../_api-clients');

const wrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('use{Domain}', () => {
  it('should fetch items', async () => {
    const mockData = { items: [{ id: '1' }], total: 1 };
    ({domain}Client.getItems as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => use{Domain}(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});
```
