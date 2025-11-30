---
name: verify-reactive
description: |
  Reactive 패턴 검증. Use when:
  (1) 구현 완료 후 Reactive 준수 확인, (2) .block() 호출 감지,
  (3) Coroutine/Flow 패턴 검증.
tools: [Grep, Read, Bash]
---

# Verify Reactive Skill

@./../_shared/reactive-guide.md

> Reactive 패턴 준수 여부 검증

## When to Use

- 구현 완료 후 Reactive 검증
- `.block()` 호출 감지
- Coroutine/Flow 패턴 검증
- WebFlux 안티패턴 검출

## Verification Steps

### Step 1: .block() 감지

```bash
# 절대 금지 패턴 검색
grep -rn "\.block()" src/main/kotlin/
grep -rn "\.blockFirst()" src/main/kotlin/
grep -rn "\.blockLast()" src/main/kotlin/
```

**예외 허용**: `src/test/` 디렉토리만

### Step 2: Coroutine 패턴 검증

```kotlin
// ✅ 올바른 패턴
suspend fun findById(id: UUID): Post? =
    repository.findById(id).awaitSingleOrNull()

// ❌ 잘못된 패턴 (blocking)
fun findById(id: UUID): Post? =
    repository.findById(id).block()
```

### Step 3: Flow 패턴 검증

```kotlin
// ✅ 올바른 패턴
fun findAll(): Flow<Post> =
    repository.findAll().asFlow()

// ❌ 잘못된 패턴
fun findAll(): List<Post> =
    repository.findAll().collectList().block()!!
```

### Step 4: Controller 검증

```kotlin
// ✅ 올바른 패턴
@GetMapping("/{id}")
suspend fun getPost(@PathVariable id: UUID): ApiResponse<PostResponse>

// ❌ 잘못된 패턴 (Mono 직접 반환)
@GetMapping("/{id}")
fun getPost(@PathVariable id: UUID): Mono<ApiResponse<PostResponse>>
```

## Anti-Patterns

| 패턴 | 문제 | 해결 |
|------|------|------|
| `.block()` | 스레드 블로킹 | `awaitSingle()` 사용 |
| `Mono<T>` 반환 | 비일관성 | `suspend fun` + `T` 반환 |
| `runBlocking` | 메인 스레드 블로킹 | `runTest` (테스트만) |
| `Thread.sleep()` | 스레드 블로킹 | `delay()` 사용 |

## Output Format

### 검증 통과

```markdown
[SAX] Skill: verify-reactive 완료

## 검증 결과: ✅ PASS

### 검사 항목
- [x] .block() 호출 없음
- [x] suspend fun 패턴 준수
- [x] Flow 패턴 준수
- [x] Controller 시그니처 정상

### 검사 범위
- 파일 수: 15
- 라인 수: 1,234
```

### 검증 실패

```markdown
[SAX] Skill: verify-reactive 완료

## 검증 결과: ❌ FAIL

### 위반 사항

| 파일 | 라인 | 위반 | 심각도 |
|------|------|------|--------|
| PostService.kt | 45 | `.block()` 호출 | 🔴 Critical |
| UserRepository.kt | 23 | `runBlocking` 사용 | 🔴 Critical |

### 수정 가이드

**PostService.kt:45**
```kotlin
// Before (❌)
val post = repository.findById(id).block()

// After (✅)
val post = repository.findById(id).awaitSingleOrNull()
```

### 다음 단계
1. 위반 사항 수정
2. `skill:verify-reactive` 재실행
```

## Critical Rules

1. **Zero Tolerance**: `.block()` 호출은 테스트 외 절대 금지
2. **suspend 필수**: Service/Repository 메서드는 모두 suspend
3. **Flow 사용**: 컬렉션 반환은 Flow<T> 사용
4. **awaitSingle**: Mono → 값 변환 시 사용

## References

- [Reactive Patterns](references/reactive-patterns.md)
- [Anti-Pattern Catalog](references/anti-patterns.md)
