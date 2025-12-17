# Improvement Patterns

> Kotlin/Spring Boot/WebFlux 환경 개선 패턴 카탈로그

## Quality Patterns

### 1. Extract Method

**Before:**
```kotlin
fun processOrder(order: Order): Mono<OrderResult> {
    // 검증 로직 (10줄)
    if (order.items.isEmpty()) throw InvalidOrderException()
    if (order.total < BigDecimal.ZERO) throw InvalidOrderException()
    // ... 더 많은 검증

    // 할인 계산 (15줄)
    val discount = calculateBaseDiscount(order)
    // ... 복잡한 계산

    // 저장 및 이벤트 발행 (10줄)
    return repository.save(order)
        .doOnNext { eventPublisher.publish(OrderCreatedEvent(it)) }
}
```

**After:**
```kotlin
fun processOrder(order: Order): Mono<OrderResult> {
    validateOrder(order)
    val discount = calculateDiscount(order)
    return saveAndPublishEvent(order, discount)
}

private fun validateOrder(order: Order) { ... }
private fun calculateDiscount(order: Order): BigDecimal { ... }
private fun saveAndPublishEvent(order: Order, discount: BigDecimal): Mono<OrderResult> { ... }
```

### 2. Replace Conditional with Polymorphism

**Before:**
```kotlin
fun calculateShipping(order: Order): BigDecimal {
    return when (order.shippingType) {
        "STANDARD" -> order.weight * BigDecimal("100")
        "EXPRESS" -> order.weight * BigDecimal("200") + BigDecimal("5000")
        "SAME_DAY" -> order.weight * BigDecimal("300") + BigDecimal("10000")
        else -> throw IllegalArgumentException()
    }
}
```

**After:**
```kotlin
sealed class ShippingStrategy {
    abstract fun calculate(order: Order): BigDecimal

    object Standard : ShippingStrategy() {
        override fun calculate(order: Order) = order.weight * BigDecimal("100")
    }

    object Express : ShippingStrategy() {
        override fun calculate(order: Order) = order.weight * BigDecimal("200") + BigDecimal("5000")
    }
}
```

### 3. Introduce Parameter Object

**Before:**
```kotlin
fun searchPosts(
    keyword: String?,
    authorId: Long?,
    startDate: LocalDate?,
    endDate: LocalDate?,
    status: PostStatus?,
    page: Int,
    size: Int
): Flux<Post>
```

**After:**
```kotlin
data class PostSearchCriteria(
    val keyword: String? = null,
    val authorId: Long? = null,
    val dateRange: ClosedRange<LocalDate>? = null,
    val status: PostStatus? = null,
    val pageable: Pageable = Pageable.ofSize(20)
)

fun searchPosts(criteria: PostSearchCriteria): Flux<Post>
```

## Performance Patterns

### 1. Batch Processing

**Before:**
```kotlin
fun processUsers(userIds: List<Long>): Flux<User> {
    return Flux.fromIterable(userIds)
        .flatMap { id -> userRepository.findById(id) }  // N번 쿼리
}
```

**After:**
```kotlin
fun processUsers(userIds: List<Long>): Flux<User> {
    return userRepository.findAllById(userIds)  // 1번 쿼리
}
```

### 2. Caching with Caffeine

**Before:**
```kotlin
fun getConfig(key: String): Mono<Config> {
    return configRepository.findByKey(key)  // 매번 DB 조회
}
```

**After:**
```kotlin
@Cacheable("configs", key = "#key")
fun getConfig(key: String): Mono<Config> {
    return configRepository.findByKey(key)
        .cache(Duration.ofMinutes(5))  // Reactor 캐시도 추가
}
```

### 3. Parallel Processing

**Before:**
```kotlin
fun enrichData(items: List<Item>): Flux<EnrichedItem> {
    return Flux.fromIterable(items)
        .flatMap { item ->
            externalApi.enrich(item)  // 순차 처리
        }
}
```

**After:**
```kotlin
fun enrichData(items: List<Item>): Flux<EnrichedItem> {
    return Flux.fromIterable(items)
        .flatMap({ item ->
            externalApi.enrich(item)
        }, 10)  // 동시성 10으로 병렬 처리
}
```

## Reactive Patterns

### 1. Replace block() with Reactive Chain

**Before:**
```kotlin
fun getFullUser(id: Long): Mono<FullUser> {
    val user = userRepository.findById(id).block()!!
    val profile = profileRepository.findByUserId(id).block()!!
    return Mono.just(FullUser(user, profile))
}
```

**After:**
```kotlin
fun getFullUser(id: Long): Mono<FullUser> {
    return userRepository.findById(id)
        .zipWith(profileRepository.findByUserId(id))
        .map { (user, profile) -> FullUser(user, profile) }
}
```

### 2. Error Handling with onError*

**Before:**
```kotlin
fun getData(): Mono<Data> {
    return externalApi.fetch()
        .map { transform(it) }
}
```

**After:**
```kotlin
fun getData(): Mono<Data> {
    return externalApi.fetch()
        .map { transform(it) }
        .onErrorResume(TimeoutException::class.java) {
            Mono.just(Data.fallback())
        }
        .onErrorMap(ApiException::class.java) {
            DataFetchException("Failed to fetch data", it)
        }
}
```

### 3. Retry with Backoff

**Before:**
```kotlin
fun callApi(): Mono<Response> {
    return webClient.get()
        .retrieve()
        .bodyToMono(Response::class.java)
}
```

**After:**
```kotlin
fun callApi(): Mono<Response> {
    return webClient.get()
        .retrieve()
        .bodyToMono(Response::class.java)
        .retryWhen(Retry.backoff(3, Duration.ofSeconds(1))
            .filter { it is WebClientResponseException.ServiceUnavailable }
            .onRetryExhaustedThrow { _, signal ->
                ApiUnavailableException("API unavailable after ${signal.totalRetries()} retries")
            }
        )
}
```

## Security Patterns

### 1. Input Validation

**Before:**
```kotlin
fun createPost(title: String, content: String): Mono<Post> {
    return postRepository.save(Post(title = title, content = content))
}
```

**After:**
```kotlin
fun createPost(request: CreatePostRequest): Mono<Post> {
    return Mono.just(request)
        .filter { it.title.length in 1..200 }
        .switchIfEmpty(Mono.error(ValidationException("Title must be 1-200 characters")))
        .filter { it.content.length in 1..10000 }
        .switchIfEmpty(Mono.error(ValidationException("Content must be 1-10000 characters")))
        .flatMap { postRepository.save(Post(title = it.title, content = it.content)) }
}
```

### 2. SQL Injection Prevention

**Before:**
```kotlin
fun findByName(name: String): Flux<User> {
    val query = "SELECT * FROM users WHERE name = '$name'"  // VULNERABLE!
    return databaseClient.sql(query).fetch().all()
}
```

**After:**
```kotlin
fun findByName(name: String): Flux<User> {
    return databaseClient.sql("SELECT * FROM users WHERE name = :name")
        .bind("name", name)
        .fetch().all()
}
```

### 3. Sensitive Data Masking

**Before:**
```kotlin
logger.info("User logged in: email=${user.email}, password=${user.password}")
```

**After:**
```kotlin
logger.info("User logged in: email=${maskEmail(user.email)}")

private fun maskEmail(email: String): String {
    val parts = email.split("@")
    return "${parts[0].take(2)}***@${parts.getOrElse(1) { "***" }}"
}
```
