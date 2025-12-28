# Domain Templates

> scaffold-mvp-domain Skill의 템플릿 모음

## 템플릿 파일

### _types/{domain}.types.ts

```typescript
// app/{domain}/_types/{domain}.types.ts
import type { components } from '@/types/core-interface';

// Base type from core-interface (adjust as needed)
// type BaseEntity = components['schemas']['Location'];

/**
 * {Domain} metadata for MVP extension
 */
export interface {Domain}Metadata {
  type: '{domain}';
  // Add MVP-specific fields here
}

/**
 * {Domain} entity
 */
export interface {Domain} {
  id: string;
  name: string;
  metadata: {Domain}Metadata;
  created_at: string;
  updated_at: string;
}

/**
 * Filters for querying {domain}s
 */
export interface {Domain}Filters {
  search?: string;
  limit?: number;
  offset?: number;
}
```

### _types/{domain}.dto.ts

```typescript
// app/{domain}/_types/{domain}.dto.ts
import type { {Domain} } from './{domain}.types';

/**
 * Request DTO for creating a {domain}
 */
export interface Create{Domain}Request {
  name: string;
  // Add required fields
}

/**
 * Request DTO for updating a {domain}
 */
export interface Update{Domain}Request {
  name?: string;
  // Add optional fields
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### _repositories/{Domain}Repository.ts

```typescript
// app/{domain}/_repositories/{Domain}Repository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { {Domain}, {Domain}Filters } from '../_types';

export class {Domain}Repository {
  /**
   * Fetch all {domain}s with optional filters
   */
  async findAll(filters?: {Domain}Filters): Promise<{Domain}[]> {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('{table_name}')  // TODO: Replace with actual table
      .select('*')
      .eq('metadata->>type', '{domain}');

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as {Domain}[];
  }

  /**
   * Fetch a single {domain} by ID
   */
  async findById(id: string): Promise<{Domain} | null> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('{table_name}')
      .select('*')
      .eq('id', id)
      .eq('metadata->>type', '{domain}')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as {Domain};
  }

  /**
   * Create a new {domain}
   */
  async create(input: Create{Domain}Request): Promise<{Domain}> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('{table_name}')
      .insert({
        name: input.name,
        metadata: {
          type: '{domain}',
          // Add metadata fields
        },
      })
      .select()
      .single();

    if (error) throw error;
    return data as {Domain};
  }
}

// Singleton instance
export const {domain}Repository = new {Domain}Repository();
```

### _api-clients/{Domain}ApiClient.ts

```typescript
// app/{domain}/_api-clients/{Domain}ApiClient.ts
import type { {Domain}, {Domain}Filters, ApiResponse } from '../_types';
import type { Create{Domain}Request, Update{Domain}Request } from '../_types';

export class {Domain}ApiClient {
  private baseUrl = '/api/{domain}';

  /**
   * Fetch all {domain}s
   */
  async get{Domain}s(filters?: {Domain}Filters): Promise<ApiResponse<{Domain}[]>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const url = `${this.baseUrl}?${params.toString()}`;
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Fetch a single {domain}
   */
  async get{Domain}(id: string): Promise<ApiResponse<{Domain}>> {
    const res = await fetch(`${this.baseUrl}/${id}`);
    return res.json();
  }

  /**
   * Create a new {domain}
   */
  async create{Domain}(input: Create{Domain}Request): Promise<ApiResponse<{Domain}>> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.json();
  }
}

// Singleton instance
export const {domain}ApiClient = new {Domain}ApiClient();
```

### _hooks/use{Domain}.ts

```typescript
// app/{domain}/_hooks/use{Domain}.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { {domain}ApiClient } from '../_api-clients';
import type { {Domain}Filters, Create{Domain}Request } from '../_types';

/**
 * Hook for fetching {domain}s
 */
export function use{Domain}s(filters?: {Domain}Filters) {
  return useQuery({
    queryKey: ['{domain}s', filters],
    queryFn: () => {domain}ApiClient.get{Domain}s(filters),
  });
}

/**
 * Hook for fetching a single {domain}
 */
export function use{Domain}(id: string) {
  return useQuery({
    queryKey: ['{domain}', id],
    queryFn: () => {domain}ApiClient.get{Domain}(id),
    enabled: !!id,
  });
}

/**
 * Hook for {domain} mutations
 */
export function use{Domain}Mutation() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (input: Create{Domain}Request) =>
      {domain}ApiClient.create{Domain}(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['{domain}s'] });
    },
  });

  return {
    create: createMutation,
  };
}
```

### _components/{Domain}List.tsx

```typescript
// app/{domain}/_components/{Domain}List.tsx
'use client';

import { use{Domain}s } from '../_hooks';
import { {Domain}Card } from './{Domain}Card';

export function {Domain}List() {
  const { data, isLoading, error } = use{Domain}s();

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>;
  }

  const {domain}s = data?.data || [];

  if ({domain}s.length === 0) {
    return <div className="text-gray-500">No {domain}s found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {{domain}s.map(({domain}) => (
        <{Domain}Card key={{domain}.id} {domain}={{domain}} />
      ))}
    </div>
  );
}
```

### _components/{Domain}Card.tsx

```typescript
// app/{domain}/_components/{Domain}Card.tsx
import type { {Domain} } from '../_types';

interface {Domain}CardProps {
  {domain}: {Domain};
}

export function {Domain}Card({ {domain} }: {Domain}CardProps) {
  return (
    <div className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-lg">{domain}.name}</h3>
      <p className="text-gray-500 text-sm">
        Created: {new Date({domain}.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
```

### page.tsx

```typescript
// app/{domain}/page.tsx
import { {Domain}List } from './_components';

export default function {Domain}Page() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{Domain}s</h1>
      <{Domain}List />
    </div>
  );
}
```
