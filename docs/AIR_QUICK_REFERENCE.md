# AIR Convention Quick Reference

**빠른 체크리스트 — 코드 작성/리뷰 시 확인**

---

## ✅ 필수 체크리스트

### 1. 파일 헤더 주석
```typescript
/**
 * @file [경로]
 * @description [역할]
 * @dependencies [의존성]
 * @usage [사용 예시]
 */
```

### 2. 함수/컴포넌트 JSDoc
```typescript
/**
 * [한 줄 설명]
 * 
 * @description [상세 설명]
 * @param [파라미터 설명]
 * @returns [반환값 설명]
 * @example [사용 예시 코드]
 */
```

### 3. 명시적 타입
- `any` 금지
- Props/State 인터페이스 정의
- 함수 파라미터/반환 타입 명시

### 4. 에러 처리 주석
```typescript
try {
  // ...
} catch (error) {
  /**
   * 예상 에러:
   * - [에러 종류 1]
   * - [에러 종류 2]
   * 처리 방식: [설명]
   */
}
```

### 5. 네이밍 규칙
- 함수: `동사+명사` (fetchBots, updateStatus)
- Boolean: `is/has/should` (isOnline, hasError)
- 상수: `UPPER_SNAKE_CASE` (API_URL)
- 컴포넌트 파일: `PascalCase.tsx` (BotCard.tsx)
- 유틸 파일: `camelCase.ts` (formatDate.ts)

---

## 🚀 빠른 템플릿

### React Component
```typescript
/**
 * @file components/[Name].tsx
 * @description [역할]
 * @usage <[Name] [props] />
 */

interface [Name]Props {
  /** [설명] */
  prop1: string;
}

/**
 * [컴포넌트 설명]
 * @param props - [Name]Props
 * @returns JSX.Element
 */
export default function [Name]({ prop1 }: [Name]Props) {
  return <div>{prop1}</div>;
}
```

### Function/Hook
```typescript
/**
 * @file lib/[category]/[name].ts
 * @description [역할]
 * @usage import { [name] } from '@/lib/[category]/[name]'
 */

/**
 * [함수 설명]
 * @param [param] - [설명]
 * @returns [반환값]
 * @example [코드]
 */
export function [name]([param]: [Type]): [ReturnType] {
  // ...
}
```

### API Route
```typescript
/**
 * @api {GET} /api/[path] [설명]
 * @apiQuery {string} [param] - [설명]
 * @apiSuccess {Type} [field] - [설명]
 * @apiError {string} error - [설명]
 */
export async function GET(request: Request) {
  // ...
}
```

---

## 📁 디렉토리 구조

```
app/                # Next.js 14 App Router
  layout.tsx        # 루트 레이아웃
  page.tsx          # 홈
  [route]/          # 동적 라우트
    page.tsx
  api/              # API Routes
    [endpoint]/
      route.ts

components/         # React 컴포넌트
  [Name].tsx

lib/                # 유틸리티
  supabase/
  utils/
  hooks/

types/              # 타입 정의
  [Name].types.ts
```

---

## 🎯 AI 프롬프트 템플릿

```
작업: [기능명]

컨텍스트:
- 파일: [경로]
- 의존성: [목록]

요구사항:
1. AIR 컨벤션 준수
2. [요구사항]

체크리스트:
- [ ] 파일 헤더
- [ ] JSDoc
- [ ] 타입 명시
- [ ] 에러 처리
```

---

## 📚 전체 문서

- [AIR_CONVENTION.md](./AIR_CONVENTION.md) - 전체 규칙 + 예시
- [AIR_EXAMPLE_BotCard.tsx](./AIR_EXAMPLE_BotCard.tsx) - 적용 예시

---

**업데이트:** 2026-03-15 | **버전:** 1.0.0
