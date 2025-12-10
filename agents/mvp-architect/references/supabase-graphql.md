# Supabase GraphQL Fallback Guide

## When to Use

- Spring Boot 백엔드가 미가동 상태일 때
- 로컬 개발 환경에서 빠른 프로토타이핑
- 직접 데이터베이스 접근이 필요한 경우

---

## Setup

### 1. Supabase Client 설정

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 2. GraphQL 설정 (선택)

```typescript
// lib/graphql/client.ts
import { GraphQLClient } from 'graphql-request';

export const graphqlClient = new GraphQLClient(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/graphql/v1`,
  {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  }
);
```

---

## Query Patterns

### Direct Supabase Query (권장)

```typescript
// _repositories/OfficeRepository.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class OfficeRepository {
  // 기본 조회
  async findAll() {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('metadata->>type', 'office');

    if (error) throw error;
    return data;
  }

  // metadata 필터 조회
  async findByCode(code: string) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('metadata->>type', 'office')
      .eq('metadata->>officeCode', code)
      .single();

    if (error) throw error;
    return data;
  }

  // 복잡한 쿼리
  async findWithFilters(filters: OfficeFilters) {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('locations')
      .select(`
        *,
        creator:users!created_by(id, username, avatar_url)
      `)
      .eq('metadata->>type', 'office');

    if (filters.minCapacity) {
      query = query.gte('metadata->>capacity', filters.minCapacity);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 10) - 1);

    if (error) throw error;
    return data;
  }
}
```

### GraphQL Query (대안)

```typescript
// _repositories/OfficeRepository.graphql.ts
import { gql } from 'graphql-request';
import { graphqlClient } from '@/lib/graphql/client';

const GET_OFFICES = gql`
  query GetOffices($type: String!) {
    locationsCollection(
      filter: { metadata: { type: { eq: $type } } }
    ) {
      edges {
        node {
          id
          name
          address
          metadata
          created_at
        }
      }
    }
  }
`;

export class OfficeGraphQLRepository {
  async findAll() {
    const data = await graphqlClient.request(GET_OFFICES, {
      type: 'office',
    });
    return data.locationsCollection.edges.map(e => e.node);
  }
}
```

---

## Mutation Patterns

```typescript
// _repositories/OfficeRepository.ts

export class OfficeRepository {
  // 생성
  async create(input: CreateOfficeInput) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: input.name,
        address: input.address,
        metadata: {
          type: 'office',
          officeCode: input.officeCode,
          capacity: input.capacity,
        },
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 수정
  async update(id: string, input: UpdateOfficeInput) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .update({
        name: input.name,
        metadata: supabase.sql`metadata || ${JSON.stringify(input.metadata)}`,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 삭제 (soft delete via metadata)
  async softDelete(id: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('locations')
      .update({
        metadata: supabase.sql`metadata || '{"deleted": true}'`,
      })
      .eq('id', id);

    if (error) throw error;
  }
}
```

---

## RLS (Row Level Security) 고려사항

```sql
-- Supabase에서 RLS 정책이 활성화된 경우
-- 적절한 정책이 설정되어 있어야 함

-- 예: 인증된 사용자만 office 데이터 조회 가능
CREATE POLICY "Authenticated users can view offices"
ON locations FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND metadata->>'type' = 'office'
);
```
