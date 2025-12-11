# Phase Workflow Guide

## Overview

```
v0.0.x SETUP ─────────────────────────────────────────────┐
  │ Dependencies, Environment                              │
  ▼                                                        │
v0.1.x DOMAIN ────────────────────────────────────────────│
  │ Scaffold 4-layer structure                             │
  ▼                                                        │
v0.2.x DATA ──────────────────────────────────────────────│
  │ Types, Repository, metadata patterns                   │
  ▼                                                        │
v0.3.x CODE ──────────────────────────────────────────────│
  │ API Client, Hooks, Components                          │
  ▼                                                        │
v0.4.x TEST ──────────────────────────────────────────────┘
  │ Integration tests, Visual verification
  ▼
  DONE → PR → Merge to Community Solution
```

---

## Phase 0: SETUP (v0.0.x)

### Purpose
프로젝트 환경과 의존성을 설정합니다.

### Tasks

1. **의존성 설치**
```bash
pnpm add @tanstack/react-query @supabase/supabase-js
pnpm add -D @types/node
```

2. **환경 변수 설정**
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

3. **Supabase 클라이언트 설정**
```typescript
// lib/supabase/client.ts
// lib/supabase/server.ts
```

4. **React Query Provider 설정**
```typescript
// providers/QueryProvider.tsx
```

### Validation
```bash
pnpm install  # 성공해야 함
pnpm dev      # 서버 실행 확인
```

### Commit
```bash
git commit -m "feat({domain}): [SETUP] Initialize {feature} dependencies"
```

---

## Phase 1: DOMAIN (v0.1.x)

### Purpose
DDD 4-layer 도메인 구조를 생성합니다.

### Tasks

1. **도메인 폴더 생성**
```bash
# skill:scaffold-mvp-domain 사용 권장
mkdir -p app/{domain}/{_repositories,_api-clients,_hooks,_components,_types}
```

2. **Index 파일 생성**
```typescript
// 각 폴더에 index.ts 생성
export {};
```

3. **page.tsx 스켈레톤**
```typescript
// app/{domain}/page.tsx
export default function DomainPage() {
  return <div>Domain Page</div>;
}
```

### Validation
```bash
ls -la app/{domain}/  # 구조 확인
pnpm build           # 빌드 성공
```

### Commit
```bash
git commit -m "feat({domain}): [DOMAIN] Scaffold {domain} 4-layer structure"
```

---

## Phase 2: DATA (v0.2.x)

### Purpose
타입 정의와 데이터 접근 레이어를 구현합니다.

### Tasks

1. **core-interface 타입 동기화**
```bash
# skill:sync-interface 실행
```

2. **도메인 타입 정의**
```typescript
// _types/{domain}.types.ts
import { BaseLocation } from '@/types/core-interface';

export interface Office extends BaseLocation {
  metadata: OfficeMetadata;
}

export interface OfficeMetadata {
  type: 'office';
  officeCode: string;
  capacity: number;
}
```

3. **Repository 구현**
```typescript
// _repositories/{Domain}Repository.ts
export class OfficeRepository {
  async findAll(): Promise<Office[]> { /* ... */ }
  async findById(id: string): Promise<Office | null> { /* ... */ }
  async create(input: CreateOfficeInput): Promise<Office> { /* ... */ }
}
```

### Validation
```bash
pnpm tsc --noEmit  # TypeScript 컴파일 통과
```

### Commit
```bash
git commit -m "feat({domain}): [DATA] Add {domain} types and repository"
```

---

## Phase 3: CODE (v0.3.x)

### Purpose
비즈니스 로직과 UI를 구현합니다.

### Tasks

1. **API Client 구현**
```typescript
// _api-clients/{Domain}ApiClient.ts
export class OfficeApiClient {
  async getOffices(): Promise<ApiResponse<Office[]>> { /* ... */ }
}
```

2. **Hooks 구현**
```typescript
// _hooks/use{Domain}.ts
export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: () => officeApiClient.getOffices(),
  });
}
```

3. **Components 구현**
```typescript
// _components/{Domain}List.tsx
export function OfficeList() { /* ... */ }

// _components/{Domain}Card.tsx
export function OfficeCard({ office }: { office: Office }) { /* ... */ }
```

4. **page.tsx 연결**
```typescript
// app/{domain}/page.tsx
import { OfficeList } from './_components';

export default function OfficePage() {
  return <OfficeList />;
}
```

### Validation
```bash
pnpm lint    # ESLint 통과
pnpm build   # 빌드 성공
```

### Commit
```bash
git commit -m "feat({domain}): [CODE] Implement {domain} hooks and components"
```

---

## Phase 4: TEST (v0.4.x)

### Purpose
테스트와 검증을 수행합니다.

### Tasks

1. **통합 테스트** (선택)
```typescript
// _repositories/__tests__/{Domain}Repository.test.ts
describe('OfficeRepository', () => {
  it('should fetch offices', async () => { /* ... */ });
});
```

2. **Antigravity 브라우저 테스트**
```
/browser-test http://localhost:3000/{domain}
```

3. **시각적 검증**
- 스크린샷 캡처
- 반응형 확인
- 인터랙션 테스트

4. **통합 검증**
```bash
# skill:verify-integration 실행
```

### Validation
```bash
pnpm test    # 테스트 통과 (있는 경우)
# Antigravity 브라우저 테스트 완료
# skill:verify-integration 통과
```

### Commit
```bash
git commit -m "feat({domain}): [TEST] Add {domain} tests and verification"
```

---

## Phase Transition Rules

### 다음 Phase로 이동 조건

| From | To | Condition |
|------|----|-----------|
| SETUP | DOMAIN | `pnpm install` && `pnpm dev` 성공 |
| DOMAIN | DATA | 폴더 구조 생성 완료 |
| DATA | CODE | TypeScript 컴파일 통과 |
| CODE | TEST | ESLint/Prettier 통과, 빌드 성공 |
| TEST | DONE | 모든 테스트 통과, 시각적 검증 완료 |

### Phase 실패 시

1. 오류 분석
2. 이전 Phase 산출물 확인
3. 누락 항목 보완
4. 현재 Phase 재시도
