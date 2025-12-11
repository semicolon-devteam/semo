# Code Smells

> Kotlin/Spring Boot/WebFlux 환경 코드 스멜 패턴

## Critical Smells (즉시 수정)

### 1. Blocking in Reactive Chain

```kotlin
// SMELL: Reactive 체인 내 블로킹 호출
fun getUser(id: Long): Mono<User> {
    val user = userRepository.findById(id).block()  // BLOCKING!
    return Mono.just(user)
}

// 탐지 패턴
grep -n "\.block()" src/
grep -n "\.blockFirst()" src/
grep -n "\.blockLast()" src/
```

### 2. Thread.sleep in Reactive

```kotlin
// SMELL: Reactive에서 Thread.sleep 사용
fun delay(): Mono<Void> {
    Thread.sleep(1000)  // BLOCKING!
    return Mono.empty()
}

// 탐지 패턴
grep -n "Thread\.sleep" src/
```

### 3. Security Credentials Hardcoded

```kotlin
// SMELL: 하드코딩된 비밀번호/토큰
val apiKey = "sk-1234567890"  // SECURITY RISK!

// 탐지 패턴
grep -rn "password\s*=" src/ --include="*.kt"
grep -rn "apiKey\s*=" src/ --include="*.kt"
grep -rn "secret\s*=" src/ --include="*.kt"
```

## High Priority Smells (권장 수정)

### 1. N+1 Query Pattern

```kotlin
// SMELL: N+1 쿼리
fun getPostsWithComments(): Flux<Post> {
    return postRepository.findAll()
        .flatMap { post ->
            commentRepository.findByPostId(post.id)  // N번 추가 쿼리!
                .collectList()
                .map { comments -> post.copy(comments = comments) }
        }
}

// 탐지: flatMap 내 repository 호출
```

### 2. Missing Error Handling

```kotlin
// SMELL: 에러 처리 누락
fun processData(): Mono<Result> {
    return externalApi.call()
        .map { transform(it) }
    // onErrorResume/onErrorReturn 없음!
}

// 탐지: Mono/Flux 체인에 onError* 없음
```

### 3. Nullable Return Without Documentation

```kotlin
// SMELL: Nullable 반환 문서화 누락
fun findUser(id: Long): User? {  // 언제 null? 왜 null?
    return repository.findById(id)
}
```

### 4. Long Method (>30 lines)

```kotlin
// SMELL: 30줄 이상 메서드
fun processOrder(order: Order): Mono<OrderResult> {
    // ... 50+ lines of code
}

// 탐지
wc -l src/**/*.kt | awk '{if($1>30) print}'
```

## Medium Priority Smells (선택적 수정)

### 1. Inconsistent Naming

```kotlin
// SMELL: 일관되지 않은 네이밍
fun getUserData()   // getData
fun fetchPosts()    // fetch
fun retrieveComments()  // retrieve

// 권장: 하나로 통일 (get* 또는 find*)
```

### 2. Magic Numbers

```kotlin
// SMELL: 매직 넘버
if (retryCount > 3) { ... }  // 3이 뭐지?
if (status == 200) { ... }   // HTTP OK

// 권장: 상수 추출
companion object {
    private const val MAX_RETRY_COUNT = 3
}
```

### 3. Commented-Out Code

```kotlin
// SMELL: 주석 처리된 코드
fun process() {
    // val oldImplementation = ...
    // if (oldCondition) { ... }
    newImplementation()
}

// 탐지
grep -n "^\s*//.*=" src/**/*.kt
```

### 4. Empty Catch Block

```kotlin
// SMELL: 빈 catch 블록
try {
    riskyOperation()
} catch (e: Exception) {
    // 무시 - BAD!
}

// 최소한 로깅
catch (e: Exception) {
    logger.warn("Operation failed", e)
}
```

## Low Priority Smells (나중에 수정)

### 1. Missing KDoc

```kotlin
// SMELL: 공개 API 문서화 누락
fun calculateDiscount(order: Order): BigDecimal {
    // 복잡한 할인 로직
}

// 권장
/**
 * 주문에 대한 할인 금액을 계산합니다.
 * @param order 할인을 적용할 주문
 * @return 할인 금액 (원 단위)
 */
fun calculateDiscount(order: Order): BigDecimal
```

### 2. Overly Long Import List

```kotlin
// SMELL: 10개 이상 import
import com.example.a
import com.example.b
// ... 15개 더

// 권장: 와일드카드 또는 패키지 정리
import com.example.*
```

### 3. Unused Parameters

```kotlin
// SMELL: 미사용 파라미터
fun process(data: Data, options: Options) {
    // options 사용 안 함
    return transform(data)
}
```

## 탐지 명령어 모음

```bash
# Critical
grep -rn "\.block()" src/ --include="*.kt"
grep -rn "Thread\.sleep" src/ --include="*.kt"

# High
grep -rn "flatMap.*repository" src/ --include="*.kt"
grep -rn "\.map\|\.flatMap" src/ --include="*.kt" | grep -v "onError"

# Medium
grep -rn "^\s*//.*[a-zA-Z].*=" src/ --include="*.kt"

# Low
grep -rn "^fun [a-z]" src/ --include="*.kt" | grep -v "/**"
```
