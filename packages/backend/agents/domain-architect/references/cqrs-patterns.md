# CQRS Patterns Reference

## Overview

CQRS (Command Query Responsibility Segregation)는 읽기와 쓰기 작업을 분리하는 패턴입니다.

## Service Separation

### CommandService

쓰기 작업 담당:

```kotlin
@Service
class PostCommandService(
    private val repository: PostRepository,
    private val validator: PostValidator
) {
    suspend fun create(request: CreatePostRequest): Post {
        validator.validateCreate(request)
        val post = Post(
            title = request.title,
            content = request.content,
            authorId = request.authorId
        )
        return repository.save(post).awaitSingle()
    }

    suspend fun update(id: UUID, request: UpdatePostRequest): Post {
        val existing = repository.findById(id).awaitSingleOrNull()
            ?: throw PostException.NotFound(id)

        val updated = existing.copy(
            title = request.title ?: existing.title,
            content = request.content ?: existing.content,
            updatedAt = Instant.now()
        )
        return repository.save(updated).awaitSingle()
    }

    suspend fun delete(id: UUID) {
        val existing = repository.findById(id).awaitSingleOrNull()
            ?: throw PostException.NotFound(id)
        repository.delete(existing).awaitSingleOrNull()
    }
}
```

### QueryService

읽기 작업 담당:

```kotlin
@Service
class PostQueryService(
    private val repository: PostRepository
) {
    suspend fun findById(id: UUID): Post? {
        return repository.findById(id).awaitSingleOrNull()
    }

    fun findAll(pageable: Pageable): Flow<Post> {
        return repository.findAllBy(pageable).asFlow()
    }

    suspend fun findByStatus(status: String): List<Post> {
        return repository.findByStatus(status).collectList().awaitSingle()
    }

    suspend fun count(): Long {
        return repository.count().awaitSingle()
    }

    suspend fun countByStatus(status: String): Long {
        return repository.countByStatus(status).awaitSingle()
    }
}
```

## When to Use

### CQRS 적용 기준

| 조건 | 적용 |
|------|------|
| 읽기/쓰기 비율 차이 큼 | ✅ 적용 |
| 복잡한 조회 로직 | ✅ 적용 |
| 단순 CRUD | ⚠️ 선택적 |
| 팀 표준 | ✅ 항상 적용 |

### Benefits

- 읽기 최적화 용이
- 쓰기 로직 분리로 트랜잭션 관리 명확
- 테스트 용이
- 확장성 향상

## Anti-Patterns

```kotlin
// ❌ WRONG: 하나의 서비스에 모든 로직
class PostService {
    fun create(): Post
    fun findById(): Post
    fun update(): Post
    fun findAll(): List<Post>
}

// ✅ CORRECT: CQRS 분리
class PostCommandService { /* 쓰기만 */ }
class PostQueryService { /* 읽기만 */ }
```
