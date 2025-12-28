# Next.js Architecture Reference

> implement, verify, review 스킬에서 참조

## DDD 4-Layer Architecture

```
src/app/{domain}/
├── _repositories/     # Layer 1: 서버사이드 데이터 접근
├── _api-clients/      # Layer 2: 브라우저 HTTP 통신
├── _hooks/            # Layer 3: React 상태 관리
├── _components/       # Layer 4: 도메인 전용 UI
└── page.tsx
```

### Layer 설명

| Layer | 역할 | 실행 환경 |
|-------|------|----------|
| `_repositories/` | Supabase 직접 접근, Server Actions | Server |
| `_api-clients/` | Spring Backend API 호출 | Browser |
| `_hooks/` | React Query, 상태 관리 | Browser |
| `_components/` | UI 컴포넌트, 이벤트 핸들링 | Browser |

### MVP 모드

간소화된 2계층 구조:
- `_hooks/` + `_components/` 만 사용
- repositories/api-clients 생략 가능

## ADD Phase 정의

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | 환경 설정, 의존성 설치 |
| v0.1.x | PROJECT | 도메인 구조 생성 (scaffold-domain) |
| v0.2.x | TESTS | TDD 테스트 작성 |
| v0.3.x | DATA | 타입, 인터페이스, DTO 정의 |
| v0.4.x | CODE | 구현 코드 작성 |
| v0.5.x | E2E | Playwright 런타임 테스트 |

## Supabase 패턴

### 타입 동기화

DB 작업 시 반드시 타입 동기화:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

### Repository 패턴

```typescript
// src/app/{domain}/_repositories/{entity}.repository.ts
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';

type Entity = Database['public']['Tables']['entity']['Row'];

export async function getEntity(id: string): Promise<Entity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('entity')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}
```

## 폴더 구조 규칙

### 도메인별 구조

```
src/app/
├── (auth)/           # 인증 그룹
│   ├── login/
│   └── register/
├── (main)/           # 메인 레이아웃 그룹
│   ├── dashboard/
│   └── settings/
└── api/              # API Routes
    └── v1/
```

### 공유 컴포넌트

```
src/
├── components/       # 공통 UI 컴포넌트
│   ├── ui/          # shadcn/ui 컴포넌트
│   └── layout/      # 레이아웃 컴포넌트
├── lib/             # 유틸리티, 설정
└── types/           # 전역 타입 정의
```

## 테스트 구조

```
src/app/{domain}/
├── __tests__/
│   ├── {entity}.repository.test.ts
│   ├── use{Entity}.test.ts
│   └── {Component}.test.tsx
```

## Related References

- [code-patterns.md](./code-patterns.md) - 코드 패턴 예시
- [layer-implementation.md](./layer-implementation.md) - 레이어별 구현 가이드
