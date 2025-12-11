---
name: run-tests
description: |
  테스트 실행 및 품질 검증. Use when:
  (1) 테스트 실행 요청, (2) 변경 후 검증 필요,
  (3) 커버리지 확인, (4) CI 전 로컬 검증.
tools: [Bash, Read, Glob, Grep]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: run-tests 호출 - {테스트 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# run-tests Skill

> Spring Boot + Kotlin 테스트 실행 및 분석 Skill

## Purpose

테스트를 실행하고 결과를 분석하여 품질을 검증합니다.

### 테스트 유형

| 유형 | 설명 | Gradle 명령 |
|------|------|-------------|
| **unit** | 단위 테스트 | `./gradlew test` |
| **integration** | 통합 테스트 | `./gradlew integrationTest` |
| **all** | 전체 테스트 | `./gradlew check` |
| **specific** | 특정 테스트 | `./gradlew test --tests "*ClassName*"` |

## Quick Start

```bash
# 1. 전체 테스트
./gradlew test

# 2. 특정 클래스
./gradlew test --tests "*UserServiceTest*"

# 3. 특정 메서드
./gradlew test --tests "*UserServiceTest.shouldCreateUser*"

# 4. 커버리지 포함
./gradlew test jacocoTestReport
```

## Workflow

### Phase 1: 테스트 탐색

```text
테스트 파일 탐색
├─ src/test/kotlin/**/*Test.kt
├─ src/test/kotlin/**/*Tests.kt
└─ src/test/kotlin/**/*Spec.kt

탐색 명령:
find src/test -name "*Test*.kt" -o -name "*Spec.kt"
```

### Phase 2: 테스트 실행

```bash
# 기본 실행
./gradlew test --info

# 실패 시 재실행
./gradlew test --rerun-tasks

# 병렬 실행
./gradlew test --parallel
```

### Phase 3: 결과 분석

```text
테스트 결과 위치:
├─ build/reports/tests/test/index.html (HTML 리포트)
├─ build/test-results/test/*.xml (JUnit XML)
└─ build/reports/jacoco/test/html/index.html (커버리지)
```

### Phase 4: 실패 분석

```bash
# 실패 테스트 로그 확인
cat build/reports/tests/test/classes/*.html | grep -A 20 "failed"

# 특정 테스트 상세 로그
./gradlew test --tests "*FailingTest*" --info
```

## Test Patterns

### 1. 단위 테스트 패턴

```kotlin
@ExtendWith(MockKExtension::class)
class UserServiceTest {

    @MockK
    private lateinit var userRepository: UserRepository

    @InjectMockKs
    private lateinit var userService: UserService

    @Test
    fun `should create user successfully`() {
        // Given
        val request = CreateUserRequest("test@example.com")
        every { userRepository.save(any()) } returns Mono.just(User(1L, "test@example.com"))

        // When
        val result = userService.createUser(request).block()

        // Then
        assertThat(result?.email).isEqualTo("test@example.com")
        verify { userRepository.save(any()) }
    }
}
```

### 2. WebFlux 테스트 패턴

```kotlin
@WebFluxTest(UserController::class)
class UserControllerTest {

    @Autowired
    private lateinit var webTestClient: WebTestClient

    @MockkBean
    private lateinit var userService: UserService

    @Test
    fun `GET users should return list`() {
        every { userService.findAll() } returns Flux.just(User(1L, "test@example.com"))

        webTestClient.get()
            .uri("/api/users")
            .exchange()
            .expectStatus().isOk
            .expectBodyList(User::class.java)
            .hasSize(1)
    }
}
```

### 3. R2DBC 통합 테스트 패턴

```kotlin
@DataR2dbcTest
@Import(TestConfig::class)
class UserRepositoryTest {

    @Autowired
    private lateinit var userRepository: UserRepository

    @Test
    fun `should find user by email`() {
        val result = userRepository.findByEmail("test@example.com")
            .block()

        assertThat(result).isNotNull
        assertThat(result?.email).isEqualTo("test@example.com")
    }
}
```

## Output Format

### 테스트 성공

```markdown
[SEMO] Skill: run-tests 완료

## 테스트 결과: ✅ 성공

| 항목 | 결과 |
|------|------|
| 총 테스트 | 127 |
| 성공 | 127 |
| 실패 | 0 |
| 스킵 | 0 |
| 실행 시간 | 23.5s |

### 커버리지 (JaCoCo)
- Line: 78.3%
- Branch: 65.2%

📄 상세 리포트: `build/reports/tests/test/index.html`
```

### 테스트 실패

```markdown
[SEMO] Skill: run-tests 완료

## 테스트 결과: ❌ 실패

| 항목 | 결과 |
|------|------|
| 총 테스트 | 127 |
| 성공 | 124 |
| 실패 | 3 |
| 스킵 | 0 |

### 실패 테스트

1. **UserServiceTest.shouldCreateUser**
   - 위치: `UserServiceTest.kt:45`
   - 에러: `NullPointerException`
   - 원인: Mock 설정 누락

2. **PostControllerTest.shouldReturnPosts**
   - 위치: `PostControllerTest.kt:78`
   - 에러: `AssertionError: expected 200 but was 401`
   - 원인: 인증 헤더 누락

### 권장 조치
1. `UserServiceTest`: `every { ... }` Mock 설정 추가
2. `PostControllerTest`: `@WithMockUser` 어노테이션 추가

디버깅 필요시 `debug-master` Agent 호출을 권장합니다.
```

## SEMO Message Format

```markdown
[SEMO] Skill: run-tests 호출 - {unit|integration|all|specific}

[SEMO] Skill: run-tests 실행 중 - {진행률}%

[SEMO] Skill: run-tests 완료 - {passed}/{total} 통과
```

## Error Handling

### 빌드 실패

```markdown
⚠️ **테스트 빌드 실패**

테스트 실행 전 컴파일 오류가 발생했습니다.

**오류**:
```
> Task :compileTestKotlin FAILED
e: UserServiceTest.kt:15: Unresolved reference: MockK
```

**해결 방법**:
1. 의존성 확인: `testImplementation("io.mockk:mockk:...")`
2. Import 확인: `import io.mockk.MockK`
```

### 타임아웃

```markdown
⚠️ **테스트 타임아웃**

테스트가 제한 시간을 초과했습니다.

**타임아웃 테스트**:
- `SlowIntegrationTest.shouldProcessLargeData` (>60s)

**권장 조치**:
1. `@Timeout(value = 120, unit = TimeUnit.SECONDS)` 추가
2. 테스트 최적화 검토
```

## Integration with Other Skills

### debug-master 연동

테스트 실패 시 자동으로 debug-master 호출 제안:

```markdown
## 다음 단계 제안

테스트 실패를 분석하시겠습니까?

→ `debug-master` Agent: 실패 원인 심층 분석
→ `improve-code` Skill: 코드 품질 개선
```

### git-workflow 연동

모든 테스트 통과 시:

```markdown
## 다음 단계 제안

✅ 모든 테스트 통과

→ `git-workflow` Skill: 커밋 및 PR 생성
```

## References

- [Test Patterns](references/test-patterns.md) - Kotlin/Spring 테스트 패턴
- [Coverage Guide](references/coverage-guide.md) - JaCoCo 커버리지 가이드
- [Troubleshooting](references/troubleshooting.md) - 일반적인 테스트 문제 해결
