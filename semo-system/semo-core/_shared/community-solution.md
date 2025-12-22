# Semicolon Community Solution Context

> Discovery/MVP 환경에서도 접근 가능한 커뮤니티 솔루션 공유 컨텍스트

## Overview

Semicolon Community Solution은 **cm-template** 기반의 표준 커뮤니티 서비스 아키텍처입니다.

## Core Stack

| 구성요소 | 기술 |
|---------|------|
| Frontend | Next.js 14 + TypeScript |
| Database | Supabase (PostgreSQL) |
| UI | Shadcn/ui + Tailwind CSS |
| Backend | Spring Boot (선택적) |

## Architecture

### DDD 4-Layer Structure

```
app/{domain}/
├── _repositories/      # 서버사이드 데이터 접근 (Supabase RPC)
├── _api-clients/       # 브라우저 HTTP 통신 (Factory Pattern)
├── _hooks/             # React Query + 상태 관리
├── _components/        # 도메인 전용 UI
└── page.tsx
```

### Layer 책임

| Layer | 위치 | 책임 |
|-------|------|------|
| Repository | `_repositories/` | Supabase RPC 호출, 서버사이드 |
| API Client | `_api-clients/` | HTTP 통신, 브라우저사이드 |
| Hooks | `_hooks/` | React Query, 상태 관리 |
| Components | `_components/` | UI 렌더링 (비즈니스 로직 금지) |

## Key Resources

### 1. core-supabase

> Supabase 통합 패턴 및 RPC 함수 레퍼런스

- **Repository**: `semicolon-devteam/core-supabase`
- **스키마 파일**: `document/combined.sql`
- **RPC 함수**: `docker/volumes/db/init/functions/{domain}/`

**RPC 함수 패턴**:
```typescript
// 파라미터는 항상 p_ 접두사
const { data } = await supabase.rpc('get_posts', {
  p_page: 1,
  p_limit: 10,
  p_category_id: null as unknown as undefined
});

// Type assertion 필수
return data as unknown as Post[];
```

### 2. core-interface

> Spring Backend API 스펙 (OpenAPI)

- **Swagger UI**: https://core-interface-ashen.vercel.app/
- **Spec File**: `core.backend.spec.json`

### 3. cm-template

> 표준 프로젝트 템플릿

- **Repository**: `semicolon-devteam/cm-template`
- **용도**: 새 커뮤니티 프로젝트 시작점

## MVP 선택 워크플로우

MVP 생성 요청 시 다음 옵션 제공:

| 옵션 | 설명 | 적합한 경우 |
|------|------|------------|
| **커뮤니티 솔루션 기반** | cm-template + DDD 4-Layer + core-supabase | 세미콜론 생태계 연동 필요 |
| **패스트트랙 (독립)** | 최소 구조, 자체 스키마 | 빠른 프로토타이핑, 독립 서비스 |

## 커뮤니티 솔루션 기반 프로젝트 시작

### 1. DB 스키마 적용

> **별도 SQL 생성 금지** - 공식 스키마 사용

```bash
# core-supabase 스키마 다운로드
curl -o combined.sql https://raw.githubusercontent.com/semicolon-devteam/core-supabase/dev/document/combined.sql

# Supabase SQL Editor에서 실행
```

### 2. 프로젝트 초기화

```bash
# cm-template 클론
npx degit semicolon-devteam/cm-template my-project
cd my-project
npm install
```

### 3. Supabase 타입 동기화

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## 관련 패키지

| 패키지 | 역할 | 설치 명령 |
|--------|------|----------|
| eng/nextjs | cm-template 구현 | `semo add eng/nextjs` |
| biz/poc | PoC/MVP 워크플로우 | `semo add biz/poc` |
| biz/discovery | 요구사항 발굴 | `semo add biz/discovery` |

## References

- [cm-template Repository](https://github.com/semicolon-devteam/cm-template)
- [core-supabase Repository](https://github.com/semicolon-devteam/core-supabase)
- [core-interface Swagger](https://core-interface-ashen.vercel.app/)
