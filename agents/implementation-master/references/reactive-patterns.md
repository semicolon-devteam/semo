# Reactive Patterns Reference

## Core Principle

> **블로킹 금지**: `.block()` 절대 사용 금지

## Coroutine Patterns

### Suspend Functions

```kotlin
// ✅ Correct
suspend fun findById(id: UUID): Post? {
    return repository.findById(id).awaitSingleOrNull()
}

// ❌ Wrong
fun findById(id: UUID): Post? {
    return repository.findById(id).block()  // NEVER!
}
```

### Flow for Collections

```kotlin
// ✅ Correct
fun findAll(): Flow<Post> {
    return repository.findAll().asFlow()
}

// ❌ Wrong
fun findAll(): List<Post> {
    return repository.findAll().collectList().block()!!
}
```

## Reactor → Coroutine Conversion

| Reactor | Coroutine |
|---------|-----------|
| `Mono<T>.block()` | `Mono<T>.awaitSingle()` |
| `Mono<T>.block()` (nullable) | `Mono<T>.awaitSingleOrNull()` |
| `Flux<T>.collectList().block()` | `Flux<T>.asFlow().toList()` |
| `Flux<T>` streaming | `Flow<T>` |

## Controller Patterns

### Suspend Endpoint

```kotlin
@GetMapping("/{id}")
suspend fun getById(@PathVariable id: UUID): ApiResponse.Success<PostResponse> {
    val post = queryService.findById(id)
        ?: throw PostException.NotFound(id)
    return ApiResponse.Success(data = post.toResponse())
}
```

### Flow Endpoint

```kotlin
@GetMapping
fun getAll(): Flow<PostResponse> {
    return queryService.findAll().map { it.toResponse() }
}
```

## Repository Patterns

### CoroutineCrudRepository

```kotlin
interface PostRepository : CoroutineCrudRepository<Post, UUID> {
    suspend fun findByStatus(status: String): List<Post>
    fun findAllByAuthorId(authorId: UUID): Flow<Post>
}
```

### Custom Repository

```kotlin
interface PostCustomRepository {
    suspend fun search(keyword: String, pageable: Pageable): Page<Post>
}

class PostCustomRepositoryImpl(
    private val client: DatabaseClient
) : PostCustomRepository {

    override suspend fun search(
        keyword: String,
        pageable: Pageable
    ): Page<Post> = coroutineScope {
        val content = client.sql("""
            SELECT * FROM posts
            WHERE title ILIKE :keyword
            LIMIT :limit OFFSET :offset
        """)
            .bind("keyword", "%$keyword%")
            .bind("limit", pageable.pageSize)
            .bind("offset", pageable.offset)
            .map { row -> row.toPost() }
            .flow()
            .toList()

        val total = client.sql("""
            SELECT COUNT(*) FROM posts
            WHERE title ILIKE :keyword
        """)
            .bind("keyword", "%$keyword%")
            .map { row -> row.get(0, Long::class.java)!! }
            .awaitSingle()

        PageImpl(content, pageable, total)
    }
}
```

## Forbidden Patterns

```kotlin
// ❌ NEVER USE
.block()
.blockFirst()
.blockLast()
.blockOptional()
Thread.sleep()
```

## Verification Command

```bash
# 프로젝트 전체에서 블로킹 호출 검색
grep -r "\.block()\|blockFirst\|blockLast\|Thread\.sleep" src/main/ --include="*.kt"
```
