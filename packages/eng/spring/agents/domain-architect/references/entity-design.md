# Entity Design Reference

## Entity Template

```kotlin
@Table("table_name")
data class Entity(
    @Id val id: UUID? = null,
    // fields...
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant? = null
)
```

## Type Mapping

| PostgreSQL | Kotlin | Notes |
|------------|--------|-------|
| `uuid` | `UUID` | Primary key |
| `text` | `String` | |
| `varchar(n)` | `String` | |
| `integer` | `Int` | |
| `bigint` | `Long` | |
| `boolean` | `Boolean` | |
| `timestamptz` | `Instant` | UTC 저장 |
| `jsonb` | `String` | JSON 문자열 |
| `enum` | `String` | String const |

## String Const Pattern

### Why Not Enum?

```kotlin
// ❌ Kotlin enum 문제점
enum class Status { DRAFT, PUBLISHED }
// - Jackson 직렬화 시 문제 가능
// - DB 값과 불일치 위험
// - 확장 어려움

// ✅ String const pattern
object Status {
    const val DRAFT = "DRAFT"
    const val PUBLISHED = "PUBLISHED"

    val ALL = listOf(DRAFT, PUBLISHED)

    fun isValid(value: String) = value in ALL
}
```

### Validation

```kotlin
object PostStatus {
    const val DRAFT = "DRAFT"
    const val PUBLISHED = "PUBLISHED"
    const val ARCHIVED = "ARCHIVED"

    val ALL = listOf(DRAFT, PUBLISHED, ARCHIVED)

    fun isValid(value: String): Boolean = value in ALL

    fun requireValid(value: String) {
        require(isValid(value)) { "Invalid status: $value" }
    }
}
```

## Entity Examples

### Basic Entity

```kotlin
@Table("posts")
data class Post(
    @Id val id: UUID? = null,
    val title: String,
    val content: String,
    val status: String = PostStatus.DRAFT,
    val authorId: UUID,
    val viewCount: Int = 0,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant? = null
)
```

### Entity with Relations

```kotlin
@Table("comments")
data class Comment(
    @Id val id: UUID? = null,
    val postId: UUID,          // FK to posts
    val authorId: UUID,        // FK to users
    val content: String,
    val parentId: UUID? = null, // Self-reference
    val createdAt: Instant = Instant.now()
)
```

## Nullable Fields

| Field Type | Nullable | Default |
|------------|----------|---------|
| Primary Key (id) | `UUID?` | `null` (auto-gen) |
| Required fields | Non-null | 필수 |
| Optional fields | Nullable | `null` |
| Timestamps | createdAt non-null, updatedAt nullable | |
