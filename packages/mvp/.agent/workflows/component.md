# Component Scaffolding Workflow

> `/component` 명령어로 호출되는 워크플로우

## 트리거

```
/component {type} {name}
```

## 프로세스

### 1. 컴포넌트 유형 분석

사용자 입력에서 다음을 추출합니다:
- 컴포넌트 유형 (List, Card, Form, Modal 등)
- 컴포넌트 이름
- 관련 도메인

### 2. 구조 설계

DDD 4-layer 패턴에 맞는 구조를 설계합니다:
```
app/{domain}/_components/
├── {Name}List.tsx
├── {Name}Card.tsx
├── {Name}Form.tsx
└── index.ts
```

### 3. 코드 템플릿 생성

컴포넌트 타입별 템플릿을 생성합니다.

---

## 컴포넌트 타입별 템플릿

### List Component

```typescript
'use client';

import { use{Domain}s } from '../_hooks';
import { {Name}Card } from './{Name}Card';

export function {Name}List() {
  const { data, isLoading, error } = use{Domain}s();

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>;
  }

  const items = data?.data || [];

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No items found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <{Name}Card key={item.id} item={item} />
      ))}
    </div>
  );
}
```

### Card Component

```typescript
import type { {Domain} } from '../_types';

interface {Name}CardProps {
  item: {Domain};
  onClick?: () => void;
}

export function {Name}Card({ item, onClick }: {Name}CardProps) {
  return (
    <div
      className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <h3 className="font-semibold text-lg">{item.name}</h3>
      {item.metadata?.type && (
        <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
          {item.metadata.type}
        </span>
      )}
      <p className="text-gray-500 text-sm mt-2">
        Created: {new Date(item.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
```

### Form Component

```typescript
'use client';

import { useState } from 'react';
import { use{Domain}Mutation } from '../_hooks';
import type { Create{Domain}Request } from '../_types';

interface {Name}FormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function {Name}Form({ onSuccess, onCancel }: {Name}FormProps) {
  const [formData, setFormData] = useState<Create{Domain}Request>({
    name: '',
    // Add more fields
  });

  const { create } = use{Domain}Mutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await create.mutateAsync(formData);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {create.isPending ? 'Creating...' : 'Create'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
```

---

## 예시

### 입력
```
/component list Office
```

### 출력
```
[SEMO] Component: OfficeList 생성

## 생성된 파일
- app/office/_components/OfficeList.tsx

## 의존성
- ../hooks/useOffices
- ./OfficeCard

## 다음 단계
1. OfficeCard 컴포넌트 생성: /component card Office
2. page.tsx에서 OfficeList import
```

---

## Claude Code 연동

생성된 컴포넌트를 Claude Code에서:

1. DDD 4-layer 구조에 맞게 배치
2. 타입 정의와 연결
3. Hooks와 연결
4. page.tsx에서 사용
