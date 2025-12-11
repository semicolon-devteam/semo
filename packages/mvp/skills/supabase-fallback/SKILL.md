---
name: supabase-fallback
description: Spring Boot 미가동 시 Supabase GraphQL 직접 쿼리 지원
tools: [Read, Write, Bash]
---

> **시스템 메시지**: `[SAX] Skill: supabase-fallback 호출 - Supabase 직접 쿼리`

# Supabase Fallback Skill

## Purpose

Spring Boot 백엔드가 미가동 상태일 때 Supabase를 직접 쿼리하여 개발을 계속할 수 있도록 지원합니다.

## Quick Start

트리거 키워드:
- "supabase 직접", "graphql", "fallback"
- "spring 없이", "백엔드 없이"

---

## 사용 시나리오

### 1. 로컬 개발 (Spring 미실행)

```typescript
// Spring Boot 백엔드가 실행되지 않을 때
// Supabase를 직접 쿼리

const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('metadata->>type', 'office');
```

### 2. 빠른 프로토타이핑

```typescript
// API 엔드포인트 구현 전 빠른 검증
// Repository에서 Supabase 직접 사용
```

### 3. 통합 테스트

```typescript
// E2E 테스트에서 실제 데이터 사용
// Supabase 테스트 프로젝트 활용
```

---

## Supabase Client 설정

### Server Client (RSC, Route Handler)

```typescript
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서는 무시
          }
        },
      },
    }
  );
}
```

### Browser Client (Client Components)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## Query Patterns

### 기본 조회

```typescript
// 전체 조회
const { data, error } = await supabase
  .from('posts')
  .select('*');

// metadata 기반 필터
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('metadata->>type', 'office');
```

### 관계 조회 (Join)

```typescript
// Foreign key 관계 조회
const { data } = await supabase
  .from('posts')
  .select(`
    *,
    author:users!created_by(id, username, avatar_url),
    board:boards!board_id(id, name)
  `)
  .eq('metadata->>type', 'office');
```

### 페이지네이션

```typescript
// 페이지네이션
const { data, count } = await supabase
  .from('posts')
  .select('*', { count: 'exact' })
  .eq('metadata->>type', 'office')
  .order('created_at', { ascending: false })
  .range(0, 9);  // 0-9 (10개)
```

### 검색

```typescript
// ilike 검색
const { data } = await supabase
  .from('posts')
  .select('*')
  .ilike('title', `%${searchTerm}%`);

// Full-text 검색 (textSearch 설정 필요)
const { data } = await supabase
  .from('posts')
  .select('*')
  .textSearch('title', searchTerm);
```

### metadata 필터링

```typescript
// 중첩 필드 접근
const { data } = await supabase
  .from('locations')
  .select('*')
  .eq('metadata->>type', 'office')
  .gte('metadata->>capacity', 10);

// 배열 포함 확인
const { data } = await supabase
  .from('locations')
  .select('*')
  .contains('metadata->amenities', ['wifi', 'parking']);
```

---

## Mutation Patterns

### 생성

```typescript
const { data, error } = await supabase
  .from('posts')
  .insert({
    title: 'New Post',
    content: 'Content here',
    board_id: boardId,
    created_by: userId,
    metadata: {
      type: 'office',
      officeId: 'uuid-here',
    },
  })
  .select()
  .single();
```

### 수정

```typescript
// 전체 업데이트
const { data, error } = await supabase
  .from('posts')
  .update({
    title: 'Updated Title',
    updated_at: new Date().toISOString(),
  })
  .eq('id', postId)
  .select()
  .single();

// metadata 병합
const { data, error } = await supabase
  .from('posts')
  .update({
    metadata: supabase.sql`metadata || '{"pinned": true}'::jsonb`,
  })
  .eq('id', postId)
  .select()
  .single();
```

### 삭제

```typescript
// Hard delete
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId);

// Soft delete (metadata 활용)
const { error } = await supabase
  .from('posts')
  .update({
    metadata: supabase.sql`metadata || '{"deleted": true, "deleted_at": "${new Date().toISOString()}"}'::jsonb`,
  })
  .eq('id', postId);
```

---

## GraphQL Alternative

### GraphQL Client 설정

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

### GraphQL Query 예시

```typescript
import { gql } from 'graphql-request';

const GET_OFFICES = gql`
  query GetOffices($type: String!) {
    locationsCollection(
      filter: { metadata: { type: { eq: $type } } }
      orderBy: { created_at: DescNullsLast }
      first: 10
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
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const data = await graphqlClient.request(GET_OFFICES, { type: 'office' });
```

---

## API Route Handler 예시

```typescript
// app/api/offices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data, error, count } = await supabase
    .from('locations')
    .select('*', { count: 'exact' })
    .eq('metadata->>type', 'office')
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'QUERY_ERROR', message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total: count,
      limit,
      offset,
    },
  });
}
```

---

## 환경별 전환

```typescript
// lib/api-factory.ts
import { SpringOfficeService } from './spring-office.service';
import { SupabaseOfficeService } from './supabase-office.service';

export function createOfficeService() {
  const useSpring = process.env.NEXT_PUBLIC_USE_SPRING === 'true';

  if (useSpring) {
    return new SpringOfficeService();
  }

  return new SupabaseOfficeService();
}
```

---

## References

- [GraphQL Patterns](references/graphql-patterns.md)
- [RPC to GraphQL](references/rpc-to-graphql.md)
