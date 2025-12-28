# DDD 4-Layer Patterns

> **Constitution Principle I**: DDD Architecture

## Layer Structure

```text
app/{domain}/
├── _repositories/          # Layer 1: 데이터 접근
│   ├── __tests__/
│   └── index.ts
├── _api-clients/           # Layer 2: API 통신
│   └── index.ts
├── _hooks/                 # Layer 3: 상태 관리
│   ├── __tests__/
│   └── index.ts
└── _components/            # Layer 4: UI
    ├── __tests__/
    └── index.ts
```

## Layer Rules Summary

| Layer | 허용 | 금지 |
|-------|------|------|
| Repository | `createServerSupabaseClient` | `'use client'`, browser APIs |
| API Client | `fetch`, Factory Pattern | Supabase 직접 접근 |
| Hooks | React Query, API Client 호출 | Supabase 직접 접근, fetch |
| Components | Hooks 호출 | API Client 직접 호출, 비즈니스 로직 |

## Repository Layer

```typescript
// ✅ CORRECT
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class {Domain}Repository {
  async get{Domain}s() {
    const supabase = await createServerSupabaseClient();
    // RPC 호출 - skill:fetch-supabase-example 참조
  }
}

// ❌ WRONG
'use client'  // Repository에서 금지
import { createBrowserClient } from '@/lib/supabase/client';  // 금지
```

## API Client Layer

```typescript
// ✅ CORRECT: Factory Pattern
export class {Domain}ApiClient {
  async get{Domain}s() { /* fetch 사용 */ }
}

export const {domain}Client = new {Domain}ApiClient();  // Singleton
```

## Hooks Layer

```typescript
// ✅ CORRECT
import { useQuery } from '@tanstack/react-query';
import { {domain}Client } from '../_api-clients';

export function use{Domain}s() {
  return useQuery({
    queryKey: ['{domain}'],
    queryFn: () => {domain}Client.get{Domain}s(),
  });
}

// ❌ WRONG
await fetch('/api/...');  // Hooks에서 직접 fetch 금지
```

## Components Layer

```typescript
// ✅ CORRECT
import { use{Domain}s } from '../_hooks';

export function {Domain}List() {
  const { data } = use{Domain}s();
  return <ul>{/* render */}</ul>;
}

// ❌ WRONG
import { {domain}Client } from '../_api-clients';  // 직접 API Client 금지
```

## Import Chain

```text
Components → Hooks → API Clients → (Repository는 Server에서 직접)
     ↓          ↓          ↓
   UI만     상태관리    데이터변환
```

## Validation Checklist

- [ ] 4개 레이어 디렉토리 존재
- [ ] 각 레이어에 `__tests__/` 존재 (API Client 제외)
- [ ] 각 레이어에 `index.ts` export 파일 존재
- [ ] Repository에 `'use client'` 없음
- [ ] Hooks에서 API Client만 호출
- [ ] Components에서 Hooks만 호출
