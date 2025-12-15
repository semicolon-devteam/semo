# Anti-Pattern Catalog

## 🔴 Critical (즉시 수정 필요)

### 1. .block() 호출

```kotlin
// ❌ WRONG
fun findById(id: UUID): Post? =
    repository.findById(id).block()

// ✅ CORRECT
suspend fun findById(id: UUID): Post? =
    repository.findById(id).awaitSingleOrNull()
```

### 2. runBlocking 사용

```kotlin
// ❌ WRONG (프로덕션 코드)
fun process() = runBlocking {
    doSomething()
}

// ✅ CORRECT (테스트만 허용)
@Test
fun `test something`() = runTest {
    doSomething()
}
```

### 3. Thread.sleep()

```kotlin
// ❌ WRONG
suspend fun waitAndProcess() {
    Thread.sleep(1000)
    process()
}

// ✅ CORRECT
suspend fun waitAndProcess() {
    delay(1000)
    process()
}
```

## 🟡 Warning (개선 권장)

### 4. Mono 직접 반환

```kotlin
// ❌ AVOID
@GetMapping("/{id}")
fun getPost(@PathVariable id: UUID): Mono<PostResponse>

// ✅ PREFER
@GetMapping("/{id}")
suspend fun getPost(@PathVariable id: UUID): PostResponse
```

### 5. collectList() 사용

```kotlin
// ❌ AVOID (메모리 이슈)
suspend fun findAll(): List<Post> =
    repository.findAll().collectList().awaitSingle()

// ✅ PREFER (스트리밍)
fun findAll(): Flow<Post> =
    repository.findAll().asFlow()
```

### 6. GlobalScope 사용

```kotlin
// ❌ AVOID
GlobalScope.launch {
    processAsync()
}

// ✅ PREFER (structured concurrency)
coroutineScope {
    launch {
        processAsync()
    }
}
```

## 검출 명령어

```bash
# .block() 검출
grep -rn "\.block()" src/main/kotlin/

# runBlocking 검출
grep -rn "runBlocking" src/main/kotlin/

# Thread.sleep 검출
grep -rn "Thread.sleep" src/main/kotlin/

# GlobalScope 검출
grep -rn "GlobalScope" src/main/kotlin/
```
