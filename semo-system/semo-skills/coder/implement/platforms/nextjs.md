# Platform: Next.js

> Next.js 프로젝트 코드 구현 가이드

---

## 감지 조건

```bash
[ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ]
```

---

## 프로젝트 구조

```
src/
├── app/                    # App Router
│   ├── (routes)/          # 라우트 그룹
│   ├── api/               # API Routes
│   └── layout.tsx
├── components/
│   ├── ui/                # 재사용 UI 컴포넌트
│   └── features/          # 기능별 컴포넌트
├── lib/
│   ├── supabase/          # Supabase 클라이언트
│   └── utils/
├── hooks/                 # Custom Hooks
└── types/                 # TypeScript 타입
```

---

## 핵심 패턴

### 1. Server vs Client Components

```tsx
// Server Component (기본값)
// - 'use client' 없음
// - 데이터 페칭 직접 수행
// - useState, useEffect 사용 불가

// Client Component
'use client'
// - 인터랙션 필요 시
// - hooks 사용 시
```

### 2. Data Fetching

```tsx
// Server Component에서 직접 fetch
async function Page() {
  const data = await fetchData()
  return <Component data={data} />
}

// Client에서 SWR/React Query
'use client'
const { data } = useSWR('/api/data', fetcher)
```

### 3. Supabase 연동

```tsx
// Server Component
import { createClient } from '@/lib/supabase/server'

async function getData() {
  const supabase = await createClient()
  const { data } = await supabase.from('table').select()
  return data
}

// Client Component
import { createClient } from '@/lib/supabase/client'
```

---

## 구현 체크리스트

- [ ] Server/Client 분리 확인
- [ ] 타입 정의 (TypeScript)
- [ ] 에러 핸들링
- [ ] Loading/Error UI
- [ ] 접근성 (a11y)

---

## 참조

- [implement SKILL.md](../SKILL.md)
- [Next.js 공식 문서](https://nextjs.org/docs)
