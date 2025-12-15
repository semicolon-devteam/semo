# CQRS Patterns Reference

## Separation Principle

| Service | Responsibility | Methods |
|---------|---------------|---------|
| CommandService | 쓰기 작업 | create, update, delete |
| QueryService | 읽기 작업 | find, search, count |

## Why Separate?

1. **Single Responsibility**: 각 서비스가 하나의 관심사에 집중
2. **Scalability**: 읽기/쓰기 독립적 확장
3. **Testing**: 테스트 단순화
4. **Optimization**: 각각 최적화 가능

## Anti-Pattern

```kotlin
// ❌ 하나의 서비스에 모든 로직
class PostService {
    fun create(): Post
    fun findById(): Post
    fun update(): Post
    fun findAll(): List<Post>
    fun delete()
}
```

## Correct Pattern

```kotlin
// ✅ CQRS 분리
class PostCommandService {
    suspend fun create(): Post
    suspend fun update(): Post
    suspend fun delete()
}

class PostQueryService {
    suspend fun findById(): Post?
    fun findAll(): Flow<Post>
    suspend fun count(): Long
}
```

## Controller Integration

```kotlin
@RestController
class PostController(
    private val commandService: PostCommandService,
    private val queryService: PostQueryService
) {
    // POST, PUT, DELETE → commandService
    // GET → queryService
}
```
