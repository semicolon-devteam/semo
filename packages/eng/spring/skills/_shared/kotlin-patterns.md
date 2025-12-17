# Kotlin Patterns Reference

## Data Class

```kotlin
data class Post(
    val id: UUID? = null,
    val title: String,
    val content: String
)
```

## String Const Pattern

```kotlin
object PostStatus {
    const val DRAFT = "DRAFT"
    const val PUBLISHED = "PUBLISHED"

    val ALL = listOf(DRAFT, PUBLISHED)
    fun isValid(value: String) = value in ALL
}
```

## Sealed Class

```kotlin
sealed class ApiResponse<T> {
    data class Success<T>(val data: T) : ApiResponse<T>()
    data class Error<T>(val message: String) : ApiResponse<T>()
}
```

## Extension Functions

```kotlin
fun Post.toResponse() = PostResponse(
    id = id!!,
    title = title,
    content = content
)
```

## Null Safety

```kotlin
// Safe call
val length = str?.length

// Elvis operator
val name = user?.name ?: "Unknown"

// Let
user?.let { process(it) }

// Require
requireNotNull(id) { "ID must not be null" }
```
