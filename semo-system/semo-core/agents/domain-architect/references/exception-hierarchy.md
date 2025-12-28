# Exception Hierarchy Reference

## Sealed Exception Pattern

```kotlin
sealed class DomainException(
    message: String,
    val errorCode: String,
    val httpStatus: HttpStatus = HttpStatus.BAD_REQUEST
) : RuntimeException(message)
```

## Domain Exception Template

```kotlin
sealed class PostException(
    message: String,
    errorCode: String,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST
) : RuntimeException(message) {

    val errorCode: String = errorCode
    val httpStatus: HttpStatus = httpStatus

    class NotFound(id: UUID) : PostException(
        message = "Post not found: $id",
        errorCode = "POST_NOT_FOUND",
        httpStatus = HttpStatus.NOT_FOUND
    )

    class AlreadyExists(title: String) : PostException(
        message = "Post with title '$title' already exists",
        errorCode = "POST_ALREADY_EXISTS",
        httpStatus = HttpStatus.CONFLICT
    )

    class InvalidStatus(
        current: String,
        target: String
    ) : PostException(
        message = "Cannot change status from $current to $target",
        errorCode = "POST_INVALID_STATUS_TRANSITION",
        httpStatus = HttpStatus.UNPROCESSABLE_ENTITY
    )

    class Unauthorized(id: UUID) : PostException(
        message = "Not authorized to modify post: $id",
        errorCode = "POST_UNAUTHORIZED",
        httpStatus = HttpStatus.FORBIDDEN
    )
}
```

## Exception Handler

```kotlin
@RestControllerAdvice
class PostExceptionHandler {

    @ExceptionHandler(PostException::class)
    suspend fun handlePostException(
        ex: PostException
    ): ResponseEntity<ApiResponse.Error> {
        val error = ApiResponse.Error(
            message = ex.message ?: "Unknown error",
            errorCode = ex.errorCode
        )
        return ResponseEntity
            .status(ex.httpStatus)
            .body(error)
    }
}
```

## Common Exception Types

| Type | HTTP Status | Use Case |
|------|-------------|----------|
| NotFound | 404 | 리소스 없음 |
| AlreadyExists | 409 | 중복 |
| InvalidStatus | 422 | 상태 전이 실패 |
| Unauthorized | 403 | 권한 없음 |
| ValidationFailed | 400 | 입력값 오류 |

## Benefits of Sealed Class

1. **Exhaustive when**: 모든 케이스 처리 강제
2. **Type safety**: 컴파일 타임 검증
3. **Domain grouping**: 도메인별 예외 그룹화
4. **Easy testing**: 예외 타입별 테스트 용이

```kotlin
// Exhaustive when
fun handleError(ex: PostException): String = when (ex) {
    is PostException.NotFound -> "Not found"
    is PostException.AlreadyExists -> "Already exists"
    is PostException.InvalidStatus -> "Invalid status"
    is PostException.Unauthorized -> "Unauthorized"
}
```
