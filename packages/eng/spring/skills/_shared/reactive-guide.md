# Reactive Guide Reference

## Core Principle

> `.block()` 절대 금지

## Suspend Functions

```kotlin
suspend fun findById(id: UUID): Post? {
    return repository.findById(id).awaitSingleOrNull()
}
```

## Flow

```kotlin
fun findAll(): Flow<Post> {
    return repository.findAll().asFlow()
}
```

## Conversion

| Reactor | Coroutine |
|---------|-----------|
| `Mono.block()` | `awaitSingle()` |
| `Mono.block()` nullable | `awaitSingleOrNull()` |
| `Flux` | `Flow` via `.asFlow()` |

## Forbidden

```kotlin
// ❌ NEVER
.block()
.blockFirst()
.blockLast()
Thread.sleep()
```
