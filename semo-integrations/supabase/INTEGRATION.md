# SEMO Integration: Supabase

> Supabase 연동 (쿼리, 동기화)

**위치**: `semo-integrations/supabase/`
**Layer**: Layer 2 (External Connections)

---

## 개요

Supabase 데이터베이스 및 인증 연동을 제공합니다.

---

## 하위 모듈

| 모듈 | 역할 | 주요 기능 |
|------|------|----------|
| **query** | DB 쿼리 | 테이블 조회, RPC 호출 |
| **sync** | 스키마 동기화 | 인터페이스 타입 생성, 마이그레이션 |

---

## 사용 예시

### 스키마 조회

```
사용자: posts 테이블 구조 알려줘

[SEMO] Integration: supabase/query 호출

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts';
```

### 타입 동기화

```
사용자: Supabase 타입 동기화해줘

[SEMO] Integration: supabase/sync 호출

npx supabase gen types typescript --project-id $PROJECT_ID
```

---

## 환경 변수

| 변수 | 용도 | 필수 |
|------|------|------|
| `SUPABASE_URL` | 프로젝트 URL | ✅ |
| `SUPABASE_ANON_KEY` | 익명 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 키 | 관리자용 |

---

## 클라이언트 패턴

### Server Component (Next.js)

```typescript
import { createClient } from '@/lib/supabase/server'

async function getData() {
  const supabase = await createClient()
  const { data } = await supabase.from('posts').select()
  return data
}
```

### Client Component

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

---

## 매핑 정보 (SEMO → SEMO)

| 기존 패키지 | 기존 스킬 | 새 위치 |
|-------------|----------|---------|
| semo-mvp | sync-interface | supabase/sync |
| semo-next | fetch-supabase-example | supabase/query |

---

## 참조

- [SEMO Principles](../../semo-core/principles/PRINCIPLES.md)
- [Supabase 문서](https://supabase.com/docs)
