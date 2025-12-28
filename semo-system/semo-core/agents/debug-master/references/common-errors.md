# Common Errors Reference

> Spring Boot + Kotlin + WebFlux 환경에서 자주 발생하는 에러 패턴

## Reactive 관련 에러

### 1. Blocking Call 위반

```kotlin
// ❌ 에러: block()/blockFirst()/blockLast() 사용
java.lang.IllegalStateException: block()/blockFirst()/blockLast() are blocking,
which is not supported in thread reactor-http-nio-*

// 원인
val result = repository.findById(id).block()  // WebFlux 스레드에서 블로킹

// ✅ 수정
val result = repository.findById(id).awaitSingleOrNull()  // suspend 함수 사용
```

### 2. 구독 누락

```kotlin
// ❌ 에러: Mono/Flux가 실행되지 않음
// 증상: 로그도 없고 DB에도 반영 안 됨

fun save(entity: Entity) {
    repository.save(entity)  // 구독 안 함 - 실행 안 됨
}

// ✅ 수정
suspend fun save(entity: Entity): Entity {
    return repository.save(entity).awaitSingle()  // 구독 + 결과 반환
}
```

### 3. Coroutine Context 누락

```kotlin
// ❌ 에러: No transaction in context
// @Transactional이 동작하지 않음

suspend fun transfer() {
    // 트랜잭션 컨텍스트 없음
}

// ✅ 수정: TransactionalOperator 사용 또는 @Transactional + 적절한 컨텍스트
@Transactional
suspend fun transfer() = coroutineScope {
    // 트랜잭션 컨텍스트 내에서 실행
}
```

---

## Null Safety 관련 에러

### 1. NullPointerException (NPE)

```kotlin
// ❌ 에러: kotlin.KotlinNullPointerException
val name = user!!.profile!!.name  // !! 연산자 남용

// ✅ 수정: 안전한 호출 + 적절한 예외
val name = user?.profile?.name
    ?: throw UserProfileNotFoundException(userId)
```

### 2. Optional 처리 실패

```kotlin
// ❌ 에러: NoSuchElementException - No value present
val user = userRepository.findById(id).get()  // 값이 없으면 예외

// ✅ 수정: orElseThrow 사용
val user = userRepository.findById(id)
    .orElseThrow { UserNotFoundException(id) }
```

---

## R2DBC / Database 관련 에러

### 1. Entity ID 매핑 오류

```kotlin
// ❌ 에러: id가 null로 저장됨
@Table("posts")
data class Post(
    val id: UUID = UUID.randomUUID(),  // DB에서 생성해야 하는데 직접 생성
    val title: String
)

// ✅ 수정: @Id + nullable
@Table("posts")
data class Post(
    @Id val id: UUID? = null,  // DB가 생성, 저장 전엔 null
    val title: String
)
```

### 2. 컬럼명 매핑 오류

```kotlin
// ❌ 에러: Unknown column 'createdAt'
data class Post(
    val createdAt: Instant  // DB는 created_at (snake_case)
)

// ✅ 수정: @Column 명시 또는 NamingStrategy 설정
data class Post(
    @Column("created_at")
    val createdAt: Instant
)
```

### 3. 타입 변환 오류

```kotlin
// ❌ 에러: Cannot convert from java.lang.String to java.util.UUID
// DB에는 VARCHAR로 저장, Entity는 UUID

// ✅ 수정: Converter 등록 또는 타입 일치
// application.yml에 UUID 변환 설정 확인
```

---

## API / Controller 관련 에러

### 1. 요청 바디 파싱 실패

```kotlin
// ❌ 에러: JSON parse error - Unrecognized field "userName"
// Request DTO와 JSON 필드명 불일치

data class CreateUserRequest(
    val username: String  // JSON은 "userName"
)

// ✅ 수정: @JsonProperty 또는 필드명 일치
data class CreateUserRequest(
    @JsonProperty("userName")
    val username: String
)
```

### 2. 검증 에러 누락 처리

```kotlin
// ❌ 에러: MethodArgumentNotValidException 미처리
// 400 에러만 나고 상세 정보 없음

// ✅ 수정: GlobalExceptionHandler에서 처리
@ExceptionHandler(MethodArgumentNotValidException::class)
fun handleValidationError(ex: MethodArgumentNotValidException): ResponseEntity<ApiResponse.Error> {
    val errors = ex.bindingResult.fieldErrors.associate {
        it.field to (it.defaultMessage ?: "Invalid")
    }
    return ResponseEntity.badRequest().body(
        ApiResponse.Error(message = "Validation failed", fieldErrors = errors)
    )
}
```

### 3. 인증/인가 에러

```kotlin
// ❌ 에러: 401 Unauthorized - JWT 만료
// 토큰 갱신 로직 누락

// ✅ 수정: 토큰 만료 확인 및 갱신 로직 추가
// SecurityConfig에서 JWT 필터 확인
```

---

## 테스트 관련 에러

### 1. Testcontainers 연결 실패

```kotlin
// ❌ 에러: Could not connect to Ryuk at localhost:xxxxx
// Docker 미실행 또는 권한 문제

// ✅ 확인사항
// 1. Docker Desktop 실행 중인지 확인
// 2. Ryuk 비활성화 (테스트용)
// testcontainers.reuse.enable=true
```

### 2. 테스트 트랜잭션 롤백 안 됨

```kotlin
// ❌ 에러: 테스트 데이터가 롤백되지 않음
// R2DBC는 기본 @Transactional 동작이 다름

// ✅ 수정: 테스트마다 데이터 정리
@BeforeEach
fun setUp() = runTest {
    repository.deleteAll().awaitFirstOrNull()
}
```

---

## 성능 관련 에러

### 1. N+1 Query

```kotlin
// ❌ 에러: 쿼리가 N+1번 실행됨
// 증상: 목록 조회 시 매우 느림

posts.map { post ->
    val author = userRepository.findById(post.authorId).awaitSingle()  // N번 호출
}

// ✅ 수정: Join 또는 Batch 조회
val authorIds = posts.map { it.authorId }
val authors = userRepository.findAllById(authorIds).toList()
val authorMap = authors.associateBy { it.id }
```

### 2. Connection Pool 고갈

```kotlin
// ❌ 에러: Connection pool exhausted
// 커넥션 누수 또는 풀 크기 부족

// ✅ 확인사항
// 1. 커넥션 반환 확인 (try-finally 또는 use)
// 2. 풀 크기 설정 확인
// spring.r2dbc.pool.max-size=20
```

---

## Quick Diagnosis Commands

```bash
# 컴파일 에러 확인
./gradlew compileKotlin 2>&1 | grep -A5 "error:"

# 테스트 실패 확인
./gradlew test 2>&1 | grep -A10 "FAILED"

# .block() 사용 검사
grep -rn "\.block()" src/main --include="*.kt"

# !! 연산자 검사
grep -rn "!!" src/main --include="*.kt"

# TODO 검사
grep -rn "TODO" src/main --include="*.kt"
```
