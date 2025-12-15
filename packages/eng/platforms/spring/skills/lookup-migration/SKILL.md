---
name: lookup-migration
description: |
  core-supabase Flyway 마이그레이션 조회. Use when:
  (1) DB 스키마 확인, (2) 테이블 구조 파악, (3) Entity 작성 전 참조.
tools: [Bash, Read, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: lookup-migration 호출 - {테이블명}` 시스템 메시지를 첫 줄에 출력하세요.

# Lookup Migration Skill

> core-supabase Flyway 마이그레이션으로 DB 스키마 확인

## Background

```text
core-supabase (Flyway Migrations)
        ↓ (CI/CD로 배포)
   PostgreSQL DB
        ↓
core-backend (R2DBC)
```

> **Note**: RPC 함수는 제거 예정. Spring Boot로 전환 중.

## When to Use

- Entity 클래스 작성 전
- Repository 구현 시 테이블 구조 확인
- 새 마이그레이션 필요 여부 판단

## Quick Start

```bash
# 마이그레이션 파일 목록 조회
gh api repos/semicolon-devteam/core-supabase/contents/docker/volumes/db/migrations \
  --jq '.[].name'

# 특정 마이그레이션 조회
gh api repos/semicolon-devteam/core-supabase/contents/docker/volumes/db/migrations/V001__create_users.sql \
  --jq '.content' | base64 -d
```

## Entity 매핑 가이드

| PostgreSQL | Kotlin (R2DBC) |
|------------|----------------|
| `uuid` | `UUID` |
| `text` | `String` |
| `varchar(n)` | `String` |
| `integer` | `Int` |
| `bigint` | `Long` |
| `boolean` | `Boolean` |
| `timestamptz` | `Instant` |
| `jsonb` | `String` (JSON) |
| `enum type` | `String` (const) |

## String Const Pattern

```kotlin
// PostgreSQL enum을 String으로 매핑
// CREATE TYPE post_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

// Kotlin에서는 String const로 표현
object PostStatus {
    const val DRAFT = "DRAFT"
    const val PUBLISHED = "PUBLISHED"
    const val ARCHIVED = "ARCHIVED"

    val ALL = listOf(DRAFT, PUBLISHED, ARCHIVED)
}
```

## Output Format

```markdown
[SEMO] Skill: lookup-migration 호출 - {table_name}

## Table: posts

### Schema

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    author_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);
```

### Entity Suggestion

```kotlin
@Table("posts")
data class Post(
    @Id val id: UUID? = null,
    val title: String,
    val content: String,
    val status: String = PostStatus.DRAFT,
    val authorId: UUID,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant? = null
)
```

### Notes
- `author_id` → `authorId` (camelCase)
- `created_at` → `createdAt`
- status는 String const pattern 사용
```

## Critical Rules

1. **Migration 확인 후 Entity 작성**
2. **R2DBC 호환 타입 사용**
3. **enum 대신 String const pattern**
4. **snake_case → camelCase 변환**

## Related Skills

- `scaffold-domain` - Entity 생성 시 사용
- `implement` - v0.3.x DATA 단계

## References

- [Schema Patterns](references/schema-patterns.md)
- [R2DBC Type Mapping](references/r2dbc-types.md)
