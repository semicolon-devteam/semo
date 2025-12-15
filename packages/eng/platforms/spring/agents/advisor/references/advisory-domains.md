# Advisory Domains Reference

## Architecture

### CQRS (Command Query Responsibility Segregation)

**When to use**:
- 읽기/쓰기 작업량 차이가 큰 경우
- 복잡한 조회 로직이 필요한 경우
- 확장성이 중요한 경우

**Team Standard**: 모든 도메인에 CQRS 적용

### DDD (Domain-Driven Design)

**Key Concepts**:
- Entity: 식별자를 가진 객체
- Value Object: 불변 객체
- Aggregate: 일관성 경계
- Repository: 데이터 접근 추상화

### Hexagonal Architecture

**Layers**:
- Domain (Core)
- Application (Use Cases)
- Infrastructure (Adapters)

## Reactive Programming

### WebFlux Best Practices

```kotlin
// ✅ Suspend function
suspend fun process(): Result

// ✅ Flow for streams
fun getAll(): Flow<Item>

// ❌ Never use
.block()
.blockFirst()
Thread.sleep()
```

### Coroutine Patterns

```kotlin
// Parallel execution
coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    combine(a.await(), b.await())
}

// Sequential execution
val a = fetchA()
val b = fetchB(a)
```

## Testing

### Test Pyramid

```text
       /\
      /E2E\      <- Few, slow, expensive
     /------\
    /Integration\ <- Some
   /------------\
  /    Unit      \ <- Many, fast, cheap
 /----------------\
```

### Testcontainers Usage

```kotlin
@Container
val postgres = PostgreSQLContainer("postgres:15")
    .withDatabaseName("test")

@DynamicPropertySource
fun properties(registry: DynamicPropertyRegistry) {
    registry.add("spring.r2dbc.url") {
        "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/test"
    }
}
```

## Performance

### Connection Pool

```yaml
spring:
  r2dbc:
    pool:
      initial-size: 5
      max-size: 20
      max-idle-time: 30m
```

### Query Optimization

- Index 적절히 사용
- N+1 문제 방지
- Pagination 필수
- 필요한 컬럼만 조회

## Security

### API Security Annotations

```kotlin
@PublicApi           // 인증 없이 접근
@RequireRole("USER") // USER 역할 필요
@RequireRole("ADMIN") // ADMIN 역할 필요
```

### JWT Validation

- Supabase JWT 사용
- 토큰 만료 검증
- Role claim 확인

## Database

### Migration Strategy

- Flyway 사용
- 버전 관리: V001__, V002__
- 롤백 스크립트 준비

### Schema Design

- UUID primary key
- timestamptz for dates
- text over varchar
- jsonb for flexible data
