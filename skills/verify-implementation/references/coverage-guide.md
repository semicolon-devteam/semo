# Coverage Guide

## 목표 커버리지

| 영역 | 목표 | 필수 |
|------|------|------|
| Line Coverage | ≥80% | ✅ |
| Branch Coverage | ≥70% | ⚠️ 권장 |
| Method Coverage | ≥85% | ⚠️ 권장 |

## 레이어별 전략

### Entity

```kotlin
// Entity는 data class로 커버리지 자동 확보
data class Post(
    val id: UUID? = null,
    val title: String,
    val content: String
)
```

### Repository

```kotlin
@Testcontainers
class PostRepositoryTest {
    @Container
    val postgres = PostgreSQLContainer("postgres:15")

    @Test
    fun `should save and find post`() = runTest {
        // Given
        val post = Post(title = "Test", content = "Content")

        // When
        val saved = repository.save(post)
        val found = repository.findById(saved.id!!)

        // Then
        assertThat(found).isNotNull()
        assertThat(found!!.title).isEqualTo("Test")
    }
}
```

### Service

```kotlin
class PostCommandServiceTest {
    private val repository = mockk<PostRepository>()
    private val service = PostCommandService(repository)

    @Test
    fun `should create post`() = runTest {
        // Given
        val request = CreatePostRequest("Title", "Content")
        coEvery { repository.save(any()) } returns Post(
            id = UUID.randomUUID(),
            title = "Title",
            content = "Content"
        )

        // When
        val result = service.create(request)

        // Then
        assertThat(result.title).isEqualTo("Title")
        coVerify { repository.save(any()) }
    }
}
```

### Controller

```kotlin
@WebFluxTest(PostController::class)
class PostControllerTest {
    @Autowired
    lateinit var webTestClient: WebTestClient

    @MockkBean
    lateinit var queryService: PostQueryService

    @Test
    fun `should get post by id`() {
        // Given
        val postId = UUID.randomUUID()
        coEvery { queryService.findById(postId) } returns Post(
            id = postId,
            title = "Test",
            content = "Content"
        )

        // When & Then
        webTestClient.get()
            .uri("/api/posts/$postId")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.data.title").isEqualTo("Test")
    }
}
```

## 제외 대상

```kotlin
// build.gradle.kts
tasks.jacocoTestReport {
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) {
                exclude(
                    "**/config/**",
                    "**/dto/**",
                    "**/*Application*"
                )
            }
        })
    )
}
```

## 커버리지 리포트

```bash
# 리포트 생성
./gradlew jacocoTestReport

# 리포트 위치
build/reports/jacoco/test/html/index.html
```
