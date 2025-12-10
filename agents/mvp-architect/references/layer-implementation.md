# Layer Implementation Guide

## DDD 4-Layer Overview

```
┌─────────────────────────────────────────────────────────┐
│                    page.tsx                             │
│                 (Route Entry)                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 4: _components/                      │
│           (Domain UI Components)                        │
│  - OfficeList, OfficeCard, OfficeForm                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Layer 3: _hooks/                          │
│        (React Query + State Management)                 │
│  - useOffices, useOfficeMutation                       │
└─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│ Layer 2: _api-clients│    │ Layer 1: _repositories│
│     (Browser)        │    │    (Server-side)      │
│  - OfficeApiClient   │    │  - OfficeRepository   │
└──────────────────────┘    └──────────────────────┘
            │                           │
            ▼                           ▼
     [Next.js API]              [Supabase Direct]
     [Spring Boot]              [GraphQL Fallback]
```

---

## Layer Dependency Rules

| Layer | Can Import From | Cannot Import From |
|-------|-----------------|-------------------|
| page.tsx | _components | - |
| _components | _hooks, _types | _repositories, _api-clients |
| _hooks | _api-clients, _types | _repositories, _components |
| _api-clients | _types | _repositories, _hooks, _components |
| _repositories | _types | _api-clients, _hooks, _components |

---

## File Naming Conventions

```
_repositories/
├── {Domain}Repository.ts      # PascalCase
├── {Domain}Repository.test.ts # Optional
└── index.ts                   # Re-export

_api-clients/
├── {Domain}ApiClient.ts       # PascalCase
└── index.ts

_hooks/
├── use{Domain}.ts             # camelCase with 'use' prefix
├── use{Domain}Mutation.ts
└── index.ts

_components/
├── {Domain}List.tsx           # PascalCase
├── {Domain}Card.tsx
├── {Domain}Form.tsx
└── index.ts

_types/
├── {domain}.types.ts          # lowercase
├── {domain}.dto.ts
└── index.ts
```

---

## Index Re-export Pattern

```typescript
// _repositories/index.ts
export { OfficeRepository } from './OfficeRepository';
export type { OfficeFilters } from './OfficeRepository';

// _hooks/index.ts
export { useOffices } from './useOffices';
export { useOfficeMutation } from './useOfficeMutation';

// Usage in components
import { useOffices } from '../_hooks';
```

---

## Server vs Client Components

```typescript
// Server Component (default in app/)
// page.tsx, layout.tsx
import { OfficeRepository } from './_repositories';

export default async function OfficePage() {
  const repo = new OfficeRepository();
  const offices = await repo.findAll();

  return <OfficeList initialData={offices} />;
}

// Client Component
// _components/OfficeList.tsx
'use client';

import { useOffices } from '../_hooks';

export function OfficeList({ initialData }) {
  const { data } = useOffices({ initialData });
  // ...
}
```
