# Metadata Extension Patterns

## Core Concept

세미콜론 커뮤니티 솔루션의 코어 테이블들은 `metadata` JSONB 컬럼을 가지고 있습니다.
MVP 프로젝트는 이 컬럼을 활용하여 스키마 수정 없이 데이터를 확장합니다.

---

## Core Tables with Metadata

| Table | Description | metadata 활용 |
|-------|-------------|--------------|
| `posts` | 게시글 | type 분기, 커스텀 필드 |
| `comments` | 댓글 | type 분기, 메타 정보 |
| `users` | 사용자 | 프로필 확장, 권한 정보 |
| `locations` | 위치/장소 | type 분기 (office, store 등) |
| `boards` | 게시판 | 게시판 설정 |

---

## Type-based Segregation Pattern

### 1. Type 필드 정의

```typescript
// MVP 타입 정의
interface MvpMetadata {
  type: 'office' | 'general';  // 분기 필드
  // ... MVP 전용 필드
}

// 쿼리 시 type으로 필터링
const offices = await supabase
  .from('locations')
  .select('*')
  .eq('metadata->>type', 'office');
```

### 2. 실제 예시: Office MVP

```typescript
// locations 테이블의 metadata 확장
interface OfficeMetadata {
  type: 'office';           // 필수: MVP 분기
  officeCode: string;       // 오피스 코드
  capacity: number;         // 수용 인원
  amenities: string[];      // 편의시설
  operatingHours: {
    open: string;           // "09:00"
    close: string;          // "18:00"
  };
  reservationEnabled: boolean;
}

// posts 테이블의 metadata 확장 (오피스 공지)
interface OfficePostMetadata {
  type: 'office_notice';
  officeId: string;
  priority: 'high' | 'medium' | 'low';
  pinned: boolean;
}
```

---

## Query Patterns

### 기본 필터링

```typescript
// type 기반 필터
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('metadata->>type', 'office_notice');
```

### 중첩 필드 접근

```typescript
// JSONB 경로 연산자 사용
const { data } = await supabase
  .from('locations')
  .select('*')
  .eq('metadata->>type', 'office')
  .gte('metadata->>capacity', 10);
```

### 배열 포함 확인

```typescript
// @> 연산자 (contains)
const { data } = await supabase
  .from('locations')
  .select('*')
  .contains('metadata->amenities', ['wifi', 'parking']);
```

### 복합 조건

```typescript
// RPC 함수 활용 (복잡한 쿼리)
const { data } = await supabase
  .rpc('find_offices_by_criteria', {
    min_capacity: 10,
    required_amenities: ['wifi'],
    open_after: '08:00',
  });
```

---

## Mutation Patterns

### 생성

```typescript
// metadata 포함 생성
const { data } = await supabase
  .from('locations')
  .insert({
    name: 'Office A',
    address: '서울시 강남구...',
    metadata: {
      type: 'office',
      officeCode: 'GN-001',
      capacity: 50,
      amenities: ['wifi', 'parking', 'cafe'],
      operatingHours: { open: '09:00', close: '18:00' },
      reservationEnabled: true,
    },
  })
  .select()
  .single();
```

### 부분 업데이트

```typescript
// metadata 병합 (기존 유지 + 업데이트)
const { data } = await supabase
  .from('locations')
  .update({
    metadata: supabase.sql`metadata || '{"capacity": 60}'::jsonb`,
  })
  .eq('id', officeId)
  .select()
  .single();
```

### 중첩 필드 업데이트

```typescript
// jsonb_set 사용
const { data } = await supabase
  .rpc('update_office_operating_hours', {
    p_office_id: officeId,
    p_open: '08:00',
    p_close: '20:00',
  });

// RPC 함수 정의 (core-supabase)
/*
CREATE OR REPLACE FUNCTION update_office_operating_hours(
  p_office_id UUID,
  p_open TEXT,
  p_close TEXT
) RETURNS locations AS $$
  UPDATE locations
  SET metadata = jsonb_set(
    jsonb_set(metadata, '{operatingHours,open}', to_jsonb(p_open)),
    '{operatingHours,close}', to_jsonb(p_close)
  )
  WHERE id = p_office_id
  RETURNING *;
$$ LANGUAGE SQL;
*/
```

---

## Indexing for Performance

metadata 필드에 자주 쿼리하는 경우 인덱스 추가:

```sql
-- Flyway 마이그레이션
-- V{version}__add_office_metadata_index.sql

-- 단일 필드 인덱스
CREATE INDEX idx_locations_metadata_type
ON locations ((metadata->>'type'));

-- 복합 인덱스
CREATE INDEX idx_locations_office
ON locations ((metadata->>'type'), (metadata->>'officeCode'))
WHERE metadata->>'type' = 'office';

-- GIN 인덱스 (배열/복잡한 쿼리용)
CREATE INDEX idx_locations_metadata_gin
ON locations USING GIN (metadata);
```

---

## When to Upgrade to Column

metadata에서 컬럼으로 전환이 필요한 경우:

| 시나리오 | 권장 |
|---------|------|
| 단순 조회/필터만 | metadata 유지 |
| 인덱스 필요 (성능) | GIN 인덱스 먼저 시도 |
| JOIN 조건으로 사용 | 컬럼 추가 고려 |
| 외래키 필요 | 컬럼 필수 |
| 트랜잭션 무결성 | 컬럼 필수 |

```sql
-- 컬럼 추가 마이그레이션
ALTER TABLE locations
ADD COLUMN mvp_office_code VARCHAR(50);

-- 기존 metadata에서 마이그레이션
UPDATE locations
SET mvp_office_code = metadata->>'officeCode'
WHERE metadata->>'type' = 'office';

-- 인덱스 추가
CREATE INDEX idx_locations_mvp_office_code
ON locations(mvp_office_code);
```
