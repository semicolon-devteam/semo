# DDD 4-Layer Patterns

> MVP 프로젝트의 DDD 4-layer 아키텍처 규칙

## 레이어 구조

```
app/{domain}/
├── _repositories/    # Layer 1: Data Access
├── _api-clients/     # Layer 2: HTTP Communication
├── _hooks/           # Layer 3: State Management
├── _components/      # Layer 4: UI Components
├── _types/           # Type Definitions
└── page.tsx          # Route Entry
```

---

## 레이어 의존성 규칙

| 레이어 | Import 가능 | Import 불가 |
|--------|------------|-------------|
| _components | _hooks, _types | _repositories, _api-clients |
| _hooks | _api-clients, _types | _repositories, _components |
| _api-clients | _types | _repositories, _hooks, _components |
| _repositories | _types | _api-clients, _hooks, _components |

---

## 파일 네이밍 규칙

### Repository
```
{Domain}Repository.ts    # PascalCase
```

### API Client
```
{Domain}ApiClient.ts     # PascalCase
```

### Hooks
```
use{Domain}.ts           # camelCase with 'use' prefix
use{Domain}Mutation.ts
```

### Components
```
{Domain}List.tsx         # PascalCase
{Domain}Card.tsx
{Domain}Form.tsx
```

### Types
```
{domain}.types.ts        # lowercase
{domain}.dto.ts
```

---

## Server vs Client Components

### Server Component (기본)
```typescript
// page.tsx, layout.tsx
import { {Domain}Repository } from './_repositories';

export default async function Page() {
  const repo = new {Domain}Repository();
  const data = await repo.findAll();
  return <{Domain}List initialData={data} />;
}
```

### Client Component
```typescript
// _components/*.tsx
'use client';

import { use{Domain}s } from '../_hooks';

export function {Domain}List() {
  const { data } = use{Domain}s();
  // ...
}
```

---

## Index Re-export 패턴

각 레이어 폴더에 index.ts를 생성하여 re-export:

```typescript
// _repositories/index.ts
export { {Domain}Repository } from './{Domain}Repository';

// _hooks/index.ts
export { use{Domain}s } from './use{Domain}';

// _components/index.ts
export { {Domain}List } from './{Domain}List';
```

---

## 타입 확장 패턴

```typescript
// _types/{domain}.types.ts
import type { components } from '@/types/core-interface';

// core-interface 타입 가져오기
type BaseEntity = components['schemas']['Location'];

// MVP 확장
export interface {Domain} extends BaseEntity {
  metadata: {Domain}Metadata;
}

export interface {Domain}Metadata {
  type: '{domain}';
  // MVP 전용 필드
}
```

---

## 컴포넌트 작성 시 주의사항

### 반응형 우선 (Mobile-first)
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### 접근성 (WCAG 2.1 AA)
- 키보드 탐색 가능
- ARIA 레이블 필수
- 색상 대비 4.5:1 이상
- 포커스 표시 명확

### 스타일링
- Tailwind CSS 사용
- 디자인 토큰 (CSS 변수) 활용
- 스페이싱: 4px 단위
