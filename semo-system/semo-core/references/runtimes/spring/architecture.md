# Spring Boot Architecture Reference

> implement, verify, review 스킬에서 참조

## Domain + CQRS Architecture

```text
domain/{domain_name}/
├── entity/              # 엔티티 (String const 패턴)
├── repository/          # R2DBC Repository + Custom
├── service/
│   ├── {Domain}CommandService.kt  # 쓰기 작업
│   └── {Domain}QueryService.kt    # 읽기 작업
├── web/
│   ├── {Domain}Controller.kt
│   ├── request/
│   └── response/
├── exception/           # Sealed Exception
└── validation/          # 검증 로직 (선택)
```

## ADD Phase 정의

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | build.gradle.kts 의존성 확인 |
| v0.1.x | PROJECT | scaffold-domain (CQRS 구조) |
| v0.2.x | TESTS | TDD (Testcontainers) |
| v0.3.x | DATA | Entity, DTO, Repository |
| v0.4.x | CODE | Service, Controller (Reactive) |

## 핵심 패턴

| 패턴 | 설명 |
|------|------|
| **CQRS** | Command/Query 서비스 분리 |
| **String const** | enum 대신 `object { const val }` |
| **Reactive** | WebFlux, R2DBC 사용 |
| **Sealed Exception** | 도메인별 예외 계층 |

## Reactive 규칙

### .block() 사용 금지

```kotlin
// ❌ 금지
val result = repository.findById(id).block()

// ✅ 올바른 방법
repository.findById(id)
    .flatMap { ... }
    .switchIfEmpty(Mono.error(...))
```

### Mono/Flux 체이닝

```kotlin
fun getUser(id: String): Mono<UserResponse> =
    userRepository.findById(id)
        .switchIfEmpty(Mono.error(UserNotFoundException(id)))
        .map { it.toResponse() }
```

## Entity 패턴

### String const 패턴

```kotlin
object UserStatus {
    const val ACTIVE = "ACTIVE"
    const val INACTIVE = "INACTIVE"
    const val DELETED = "DELETED"
}

@Table("users")
data class User(
    @Id val id: String,
    val status: String = UserStatus.ACTIVE,
    // ...
)
```

## Service 분리

### CommandService

```kotlin
@Service
class UserCommandService(
    private val userRepository: UserRepository
) {
    fun createUser(request: CreateUserRequest): Mono<User> = ...
    fun updateUser(id: String, request: UpdateUserRequest): Mono<User> = ...
    fun deleteUser(id: String): Mono<Void> = ...
}
```

### QueryService

```kotlin
@Service
class UserQueryService(
    private val userRepository: UserRepository
) {
    fun getUser(id: String): Mono<UserResponse> = ...
    fun listUsers(criteria: UserSearchCriteria): Flux<UserResponse> = ...
}
```

## 테스트 패턴

### Testcontainers

```kotlin
@SpringBootTest
@Testcontainers
class UserServiceTest {
    companion object {
        @Container
        val postgres = PostgreSQLContainer("postgres:15")
            .withDatabaseName("test")
    }

    @Test
    fun `should create user`() = runTest {
        // given, when, then
    }
}
```

## Related References

- [reactive.md](./reactive.md) - Reactive 프로그래밍 가이드
- [cqrs-patterns.md](./cqrs-patterns.md) - CQRS 상세 패턴
