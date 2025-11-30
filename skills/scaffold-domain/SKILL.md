---
name: scaffold-domain
description: |
  Spring Boot CQRS 도메인 구조 생성. Use when:
  (1) 새 도메인 구현 시작, (2) v0.1.x PROJECT 단계,
  (3) CQRS 구조 필요 시.
tools: [Bash, Write]
---

# Scaffold Domain Skill

@./../_shared/cqrs-patterns.md
@./../_shared/kotlin-patterns.md

> Spring Boot CQRS 도메인 구조 생성

## When to Use

- 새 도메인 구현 시작 시
- v0.1.x PROJECT 단계
- CQRS 패턴 적용 시

## Generated Structure

```text
domain/{domain_name}/
├── entity/
│   └── {Domain}.kt
├── repository/
│   └── {Domain}Repository.kt
├── service/
│   ├── {Domain}CommandService.kt
│   └── {Domain}QueryService.kt
├── web/
│   ├── {Domain}Controller.kt
│   ├── request/
│   │   ├── Create{Domain}Request.kt
│   │   └── Update{Domain}Request.kt
│   └── response/
│       └── {Domain}Response.kt
├── exception/
│   ├── {Domain}Exception.kt
│   └── {Domain}ExceptionHandler.kt
└── validation/ (선택)
    └── {Domain}Validator.kt
```

## Usage

```javascript
skill: scaffold-domain("posts");

// Creates:
// domain/posts/entity/Post.kt
// domain/posts/repository/PostRepository.kt
// domain/posts/service/PostCommandService.kt
// domain/posts/service/PostQueryService.kt
// domain/posts/web/PostController.kt
// domain/posts/exception/PostException.kt
```

## Output Format

```markdown
[SAX] Skill: scaffold-domain 호출 - {domain}

## ✅ 도메인 구조 생성 완료

```text
domain/posts/
├── entity/Post.kt
├── repository/PostRepository.kt
├── service/
│   ├── PostCommandService.kt
│   └── PostQueryService.kt
├── web/
│   ├── PostController.kt
│   ├── request/
│   │   ├── CreatePostRequest.kt
│   │   └── UpdatePostRequest.kt
│   └── response/
│       └── PostResponse.kt
└── exception/
    ├── PostException.kt
    └── PostExceptionHandler.kt
```

**다음 단계**:
1. `skill:lookup-migration` - 스키마 확인
2. Entity 필드 채우기
3. Repository 메서드 정의
```

## Template Files

### Entity

```kotlin
@Table("{table_name}")
data class {Domain}(
    @Id val id: UUID? = null,
    // TODO: Add fields from migration
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant? = null
)
```

### Repository

```kotlin
interface {Domain}Repository : CoroutineCrudRepository<{Domain}, UUID> {
    // TODO: Add custom queries
}
```

### CommandService

```kotlin
@Service
class {Domain}CommandService(
    private val repository: {Domain}Repository
) {
    suspend fun create(request: Create{Domain}Request): {Domain} {
        TODO("Implement")
    }

    suspend fun update(id: UUID, request: Update{Domain}Request): {Domain} {
        TODO("Implement")
    }

    suspend fun delete(id: UUID) {
        TODO("Implement")
    }
}
```

### QueryService

```kotlin
@Service
class {Domain}QueryService(
    private val repository: {Domain}Repository
) {
    suspend fun findById(id: UUID): {Domain}? {
        return repository.findById(id)
    }

    fun findAll(): Flow<{Domain}> {
        return repository.findAll()
    }
}
```

## Critical Rules

1. **CQRS 분리**: Command/Query Service 분리 필수
2. **String const pattern**: enum 대신 사용
3. **Sealed Exception**: 도메인별 예외 계층
4. **Reactive**: suspend function, Flow 사용

## Related Skills

- `implement` - v0.1.x PROJECT에서 호출
- `lookup-migration` - Entity 작성 전 스키마 확인
- `sync-openapi` - Controller 작성 시 API 스펙 확인

## References

- [Layer Templates](references/layer-templates.md)
- [CQRS Patterns](references/cqrs-patterns.md)
