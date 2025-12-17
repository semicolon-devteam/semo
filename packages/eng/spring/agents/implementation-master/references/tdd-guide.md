# TDD Guide Reference

## TDD Cycle

```text
Red → Green → Refactor
 │       │        │
 │       │        └─ 코드 개선 (테스트 유지)
 │       └─ 테스트 통과하는 최소 코드
 └─ 실패하는 테스트 작성
```

## Test Structure

### Repository Test

```kotlin
@Testcontainers
@DataR2dbcTest
class PostRepositoryTest {

    @Container
    companion object {
        val postgres = PostgreSQLContainer("postgres:15")
            .withDatabaseName("test")
            .withUsername("test")
            .withPassword("test")
    }

    @Autowired
    lateinit var repository: PostRepository

    @Test
    fun `should save post`() = runTest {
        // Given
        val post = Post(
            title = "Test Post",
            content = "Test Content",
            authorId = UUID.randomUUID()
        )

        // When
        val saved = repository.save(post)

        // Then
        assertThat(saved.id).isNotNull()
        assertThat(saved.title).isEqualTo("Test Post")
    }

    @Test
    fun `should find by status`() = runTest {
        // Given
        val post = Post(
            title = "Published Post",
            content = "Content",
            status = PostStatus.PUBLISHED,
            authorId = UUID.randomUUID()
        )
        repository.save(post)

        // When
        val found = repository.findByStatus(PostStatus.PUBLISHED).toList()

        // Then
        assertThat(found).hasSize(1)
        assertThat(found[0].status).isEqualTo(PostStatus.PUBLISHED)
    }
}
```

### Service Test

```kotlin
@ExtendWith(MockKExtension::class)
class PostCommandServiceTest {

    @MockK
    lateinit var repository: PostRepository

    @InjectMockKs
    lateinit var service: PostCommandService

    @Test
    fun `should create post`() = runTest {
        // Given
        val request = CreatePostRequest(
            title = "New Post",
            content = "Content"
        )
        val savedPost = Post(
            id = UUID.randomUUID(),
            title = "New Post",
            content = "Content"
        )
        coEvery { repository.save(any()) } returns savedPost

        // When
        val result = service.create(request)

        // Then
        assertThat(result.title).isEqualTo("New Post")
        coVerify { repository.save(any()) }
    }

    @Test
    fun `should throw NotFound when updating non-existent post`() = runTest {
        // Given
        val id = UUID.randomUUID()
        coEvery { repository.findById(id) } returns null

        // When & Then
        assertThrows<PostException.NotFound> {
            service.update(id, UpdatePostRequest(title = "Updated"))
        }
    }
}
```

### Controller Test

```kotlin
@WebFluxTest(PostController::class)
class PostControllerTest {

    @Autowired
    lateinit var webTestClient: WebTestClient

    @MockkBean
    lateinit var commandService: PostCommandService

    @MockkBean
    lateinit var queryService: PostQueryService

    @Test
    fun `should create post`() {
        // Given
        val request = CreatePostRequest(title = "New", content = "Content")
        val post = Post(id = UUID.randomUUID(), title = "New", content = "Content")
        coEvery { commandService.create(any()) } returns post

        // When & Then
        webTestClient.post()
            .uri("/api/v1/posts")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(request)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.success").isEqualTo(true)
            .jsonPath("$.data.title").isEqualTo("New")
    }
}
```

## Test Dependencies

```kotlin
// build.gradle.kts
dependencies {
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    testImplementation("io.mockk:mockk:1.13.9")
    testImplementation("com.ninja-squad:springmockk:4.0.2")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:r2dbc")
}
```

## Best Practices

1. **Given-When-Then**: 테스트 구조화
2. **단일 책임**: 테스트당 하나의 검증
3. **명확한 이름**: 테스트 의도 명시
4. **독립성**: 테스트 간 의존성 없음
5. **Testcontainers**: 실제 DB 사용
