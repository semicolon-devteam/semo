# Reactive Patterns Reference

## Coroutine + Reactor 통합

### Repository Layer

```kotlin
interface PostRepository : CoroutineCrudRepository<Post, UUID> {
    fun findByAuthorId(authorId: UUID): Flow<Post>
    suspend fun findBySlug(slug: String): Post?
}
```

### Service Layer

```kotlin
@Service
class PostQueryService(
    private val repository: PostRepository
) {
    suspend fun findById(id: UUID): Post =
        repository.findById(id)
            ?: throw PostException.NotFound(id)

    fun findByAuthor(authorId: UUID): Flow<Post> =
        repository.findByAuthorId(authorId)
}
```

### Controller Layer

```kotlin
@RestController
@RequestMapping("/api/posts")
class PostController(
    private val queryService: PostQueryService
) {
    @GetMapping("/{id}")
    suspend fun getPost(@PathVariable id: UUID): ApiResponse<PostResponse> =
        ApiResponse.success(queryService.findById(id).toResponse())

    @GetMapping
    fun getPosts(): Flow<PostResponse> =
        queryService.findAll().map { it.toResponse() }
}
```

## Reactor → Coroutine 변환

| Reactor | Coroutine |
|---------|-----------|
| `Mono<T>` | `suspend fun: T` |
| `Flux<T>` | `Flow<T>` |
| `.block()` | `.awaitSingle()` |
| `.subscribe()` | `collect {}` |
| `.map {}` | `.map {}` |
| `.flatMap {}` | `.flatMapConcat {}` |

## 변환 함수

```kotlin
// Mono → suspend
suspend fun <T> Mono<T>.awaitSingleOrNull(): T? =
    this.awaitSingleOrNull()

// Flux → Flow
fun <T> Flux<T>.asFlow(): Flow<T> =
    this.asFlow()

// Flow → Flux
fun <T> Flow<T>.asFlux(): Flux<T> =
    this.asFlux()
```

## 트랜잭션 처리

```kotlin
@Service
class PostCommandService(
    private val repository: PostRepository,
    private val transactionalOperator: TransactionalOperator
) {
    suspend fun create(request: CreatePostRequest): Post =
        transactionalOperator.executeAndAwait {
            repository.save(request.toEntity())
        }
}
```
