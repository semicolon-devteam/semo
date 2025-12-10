# Schema Extension Strategy

> MVP 프로젝트의 스키마 확장 규칙

## 확장 우선순위

| 우선순위 | 전략 | 조건 | 예시 |
|---------|------|------|------|
| 1순위 | metadata JSONB | 기존 테이블 데이터 확장 | `{"type": "office"}` |
| 2순위 | 컬럼 추가 | 쿼리 성능/인덱싱 필요 | `office_code VARCHAR` |
| 3순위 | 테이블 생성 | 새로운 엔티티 필요 | `mvp_reservations` |

---

## 1순위: metadata JSONB 확장

### 패턴

```sql
-- 기존 core 테이블의 metadata 컬럼 활용
UPDATE posts SET metadata = metadata || '{"type": "office", "office_id": "uuid"}';

-- 쿼리
SELECT * FROM posts WHERE metadata->>'type' = 'office';
```

### TypeScript 타입

```typescript
interface OfficePostMetadata {
  type: 'office_notice';
  officeId: string;
  pinned: boolean;
}
```

### 장점
- Core 스키마 변경 없음
- 마이그레이션 불필요
- 빠른 프로토타이핑

### 단점
- 인덱싱 제한 (GIN 인덱스 필요)
- JOIN 어려움
- 타입 안전성 약함

---

## 2순위: 컬럼 추가

### 사용 시점
- metadata 쿼리 성능 저하
- 인덱싱이 필요한 필드
- 자주 조회되는 필드

### 패턴

```sql
-- Flyway 마이그레이션 필수
-- V{version}__add_mvp_columns.sql

ALTER TABLE posts
ADD COLUMN mvp_office_code VARCHAR(50);

CREATE INDEX idx_posts_mvp_office_code
ON posts(mvp_office_code);
```

### 네이밍 규칙
- 접두사: `mvp_`
- 형식: snake_case
- 예: `mvp_office_code`, `mvp_reservation_id`

---

## 3순위: 신규 테이블 생성

### 사용 시점
- 완전히 새로운 도메인/엔티티
- 기존 테이블과 연관 없는 데이터
- 복잡한 관계 필요

### 패턴

```sql
-- Flyway 마이그레이션 필수
-- V{version}__create_mvp_reservations.sql

CREATE TABLE mvp_office_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES locations(id),
  user_id UUID REFERENCES users(id),
  reserved_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mvp_reservations_office
ON mvp_office_reservations(office_id);

CREATE INDEX idx_mvp_reservations_user
ON mvp_office_reservations(user_id);
```

### 네이밍 규칙
- 접두사: `mvp_`
- 형식: `mvp_{domain}_{entity}`
- 예: `mvp_office_reservations`, `mvp_office_amenities`

---

## Flyway 마이그레이션 규칙

### 파일 네이밍
```
V{version}__{description}.sql
```

예시:
- `V20251211001__add_mvp_office_code_to_posts.sql`
- `V20251211002__create_mvp_office_reservations.sql`

### 위치
core-supabase 리포지토리:
```
docker/volumes/db/migrations/
```

### PR 프로세스
1. core-supabase 리포에 마이그레이션 파일 추가
2. PR 생성
3. 리뷰 및 머지
4. MVP 프로젝트에서 사용

---

## 검증 체크리스트

### metadata 확장 시
- [ ] type 필드로 MVP 데이터 분리
- [ ] 쿼리 성능 확인 (필요 시 GIN 인덱스)

### 컬럼 추가 시
- [ ] Flyway 마이그레이션 작성
- [ ] mvp_ 접두사 사용
- [ ] 인덱스 추가 (조회 빈도 높은 경우)

### 테이블 생성 시
- [ ] Flyway 마이그레이션 작성
- [ ] mvp_ 접두사 사용
- [ ] 외래키 관계 정의
- [ ] 기본 인덱스 추가
- [ ] metadata 컬럼 포함 (향후 확장용)

---

## 주의사항

### 절대 금지
- Core 테이블 직접 수정 (ALTER TABLE posts...)
- Core 테이블 컬럼 삭제
- 기존 외래키 관계 변경

### 권장
- metadata 확장 우선 시도
- 성능 문제 발생 시 컬럼/테이블로 마이그레이션
- 모든 변경사항 문서화
