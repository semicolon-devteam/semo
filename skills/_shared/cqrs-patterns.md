# CQRS Patterns Reference

## Service Separation

### CommandService (쓰기)

```kotlin
@Service
class PostCommandService(
    private val repository: PostRepository
) {
    suspend fun create(request: CreatePostRequest): Post
    suspend fun update(id: UUID, request: UpdatePostRequest): Post
    suspend fun delete(id: UUID)
}
```

### QueryService (읽기)

```kotlin
@Service
class PostQueryService(
    private val repository: PostRepository
) {
    suspend fun findById(id: UUID): Post?
    fun findAll(): Flow<Post>
    suspend fun count(): Long
}
```

## Why CQRS?

- 읽기/쓰기 최적화 분리
- 확장성 향상
- 테스트 용이
- 관심사 분리
