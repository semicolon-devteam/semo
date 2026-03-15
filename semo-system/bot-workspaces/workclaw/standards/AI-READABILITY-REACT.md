# AI Readability 코드 표준 (React/Next.js)

> React + Next.js 프로젝트 특화 규칙

**[← Core 규칙 보기](./AI-READABILITY.md)**

---

## 1. Import 순서

ESLint `import/order`로 자동 강제:

```typescript
// 1. React
import React, { useCallback, useState, useMemo } from 'react';

// 2. Next.js
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// 3. 외부 라이브러리
import { format } from 'date-fns';
import clsx from 'clsx';

// 4. 내부 절대경로 (@/)
import { COLORS } from '@/constants/theme';
import { apiService } from '@/services/api.service';
import { Button } from '@/components/ui/Button';

// 5. 타입 import
import type { User } from '@/types';

// 6. 상대경로
import { styles } from './Component.styles';
```

---

## 2. 컴포넌트 구조 패턴

### 2-1. 표준 구조

```typescript
/**
 * @module UserProfileCard
 * @description 사용자 프로필 카드 컴포넌트
 * @dependencies UserService, Avatar
 */

// ═══════════════════════════════════════
// Imports
// ═══════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { Avatar } from '@/components/ui/Avatar';

// ═══════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════
interface UserProfileCardProps {
  userId: string;
  onEdit?: () => void;
}

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════
const MAX_BIO_LENGTH = 200;

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export const UserProfileCard: React.FC<UserProfileCardProps> = ({ userId, onEdit }) => {
  // Hooks 순서: useState → useRef → useCallback → useMemo → useEffect
  const [isEditing, setIsEditing] = useState(false);
  
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    onEdit?.();
  }, [onEdit]);

  // Early returns
  if (!userId) return null;

  // JSX
  return (
    <div className="profile-card">
      <Avatar userId={userId} />
      {/* ... */}
    </div>
  );
};
```

### 2-2. Hooks 순서 (강제)

```typescript
// 1. useState
const [state, setState] = useState(initialValue);

// 2. useRef
const ref = useRef<HTMLDivElement>(null);

// 3. useCallback
const handleClick = useCallback(() => { ... }, []);

// 4. useMemo
const computed = useMemo(() => { ... }, [deps]);

// 5. useEffect
useEffect(() => { ... }, [deps]);

// 6. 커스텀 훅
const { data } = useUserData(userId);
```

---

## 3. 스타일 관리

### 3-1. Tailwind CSS 사용 시

**원칙**: 조건부 스타일은 `clsx` 또는 `cn` 유틸리티 사용

```typescript
// Bad - 인라인 조건부 스타일
<div className={`base-class ${isActive ? 'active' : 'inactive'} ${isLarge ? 'text-lg' : 'text-sm'}`}>

// Good - clsx 사용
<div className={clsx(
  'base-class',
  isActive ? 'active' : 'inactive',
  isLarge && 'text-lg'
)}>
```

**클래스 순서** (Tailwind 권장):
```typescript
<div className={clsx(
  // 1. Layout
  'flex items-center justify-between',
  // 2. Spacing
  'p-4 gap-2',
  // 3. Sizing
  'w-full h-auto',
  // 4. Typography
  'text-sm font-medium',
  // 5. Visual
  'bg-white border border-gray-200 rounded-lg',
  // 6. State
  'hover:bg-gray-50 focus:ring-2'
)}>
```

### 3-2. CSS Modules 사용 시

**파일명**: `Component.module.css`

```css
/* Component.module.css */
.container {
  display: flex;
  /* ... */
}

.title {
  font-size: 1.5rem;
  /* ... */
}
```

```typescript
// Component.tsx
import styles from './Component.module.css';

export const Component = () => (
  <div className={styles.container}>
    <h1 className={styles.title}>Title</h1>
  </div>
);
```

---

## 4. Server Components vs Client Components (Next.js)

### 4-1. 기본 원칙

- **기본값**: Server Component (명시 없음)
- **Client Component**: `'use client'` 지시어 필요

```typescript
// ❌ Bad - 불필요한 Client Component
'use client';

export const StaticCard = ({ title }: { title: string }) => (
  <div>{title}</div>
);

// ✅ Good - Server Component (기본값)
export const StaticCard = ({ title }: { title: string }) => (
  <div>{title}</div>
);
```

### 4-2. Client Component 사용 시점

- 상태 관리 (`useState`, `useReducer`)
- 이벤트 핸들러 (`onClick`, `onChange` 등)
- 브라우저 전용 API (`window`, `localStorage` 등)
- React 생명주기 훅 (`useEffect`, `useLayoutEffect`)

```typescript
// ✅ Good - Client Component 필요
'use client';

export const InteractiveButton = () => {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
};
```

### 4-3. 혼합 패턴

Server Component에서 Client Component를 children으로 전달:

```typescript
// app/page.tsx (Server Component)
import { ClientSidebar } from '@/components/ClientSidebar';

export default function Page() {
  return (
    <div>
      <ClientSidebar />
      <main>{/* Server-rendered content */}</main>
    </div>
  );
}
```

---

## 5. 커스텀 훅 분리

### 5-1. 분리 기준

다음 경우 커스텀 훅으로 분리:

- 데이터 페칭 로직
- 복잡한 상태 관리 (3개 이상 `useState`)
- 재사용 가능한 로직
- 80줄 이상 로직

```typescript
// hooks/useUserData.ts
/**
 * @module useUserData
 * @description 사용자 데이터 페칭 및 캐싱
 * @depends-on apiService.getUser()
 */
export const useUserData = (userId: string) => {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const user = await apiService.getUser(userId);
      setData(user);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
};
```

```typescript
// components/UserProfile.tsx
export const UserProfile = ({ userId }: { userId: string }) => {
  const { data, loading, error } = useUserData(userId);
  
  if (loading) return <Spinner />;
  if (error) return <ErrorView error={error} />;
  if (!data) return null;
  
  return <div>{data.name}</div>;
};
```

---

## 6. Context Headers (React 특화)

```typescript
/**
 * @module LoginForm
 * @description 이메일/비밀번호 로그인 폼
 * @dependencies AuthContext, useForm (react-hook-form)
 * @business-rules
 *  - 이메일 형식 검증
 *  - 비밀번호 최소 8자
 *  - 로그인 실패 시 에러 메시지 표시
 * @state-management
 *  - Local state: formData, errors
 *  - Global state: AuthContext (user, isAuthenticated)
 * @side-effects
 *  - 로그인 성공 시 /dashboard로 리다이렉트
 *  - 실패 시 에러 로그 전송
 */
```

---

## 7. 파일 분리 패턴

### 7-1. 기본 구조

```
features/auth/
├── components/
│   ├── LoginForm.tsx          # 로그인 폼 (Client)
│   ├── SignupForm.tsx         # 회원가입 폼 (Client)
│   └── AuthProvider.tsx       # Context Provider (Client)
├── hooks/
│   ├── useAuth.ts             # 인증 훅
│   └── useLoginForm.ts        # 로그인 폼 훅
├── services/
│   └── authService.ts         # API 호출
├── types/
│   └── auth.types.ts          # 타입 정의
└── utils/
    └── validation.ts          # 검증 함수
```

### 7-2. 페이지 구조 (Next.js App Router)

```
app/
├── (auth)/                    # Route Group
│   ├── login/
│   │   └── page.tsx          # /login
│   └── signup/
│       └── page.tsx          # /signup
├── dashboard/
│   ├── page.tsx              # /dashboard (Server)
│   └── layout.tsx            # Dashboard Layout
└── layout.tsx                # Root Layout
```

---

## 8. ESLint 설정 (React 특화)

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    // React
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/jsx-curly-brace-presence": ["warn", { "props": "never", "children": "never" }],
    
    // Hooks
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    
    // Import 순서
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
      "pathGroups": [
        { "pattern": "react", "group": "external", "position": "before" },
        { "pattern": "next/**", "group": "external", "position": "before" },
        { "pattern": "@/**", "group": "internal" }
      ],
      "pathGroupsExcludedImportTypes": ["react", "next"],
      "alphabetize": { "order": "asc" }
    }]
  }
}
```

---

## 9. 체크리스트 (React 추가)

Core 체크리스트에 추가:

- [ ] Server Component vs Client Component 구분이 명확한가?
- [ ] 불필요한 `'use client'` 사용하지 않았는가?
- [ ] Hooks 순서가 올바른가? (useState → useCallback → useEffect)
- [ ] 80줄 이상 로직은 커스텀 훅으로 분리했는가?
- [ ] Tailwind 클래스 순서가 일관적인가?
- [ ] `import/order` 규칙 통과했는가?

---

## 참고 자료

- [React 공식 문서](https://react.dev/)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Tailwind CSS 공식 문서](https://tailwindcss.com/docs)
