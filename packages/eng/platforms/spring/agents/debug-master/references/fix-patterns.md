# Fix Patterns Reference

> 일반적인 버그 수정 패턴 및 모범 사례

## 수정 원칙

### 최소 침습적 수정 (Minimal Invasive Fix)

```text
DO:
- 문제가 되는 정확한 지점만 수정
- 기존 로직 유지
- 기존 테스트 통과 유지

DON'T:
- 버그 수정과 함께 리팩토링
- "더 나은" 방식으로 전체 재작성
- 관련 없는 코드 정리
```

### 수정 전 체크리스트

```markdown
- [ ] 문제 재현 확인
- [ ] Root Cause 명확히 파악
- [ ] 영향 범위 분석 완료
- [ ] 테스트 방안 정의
- [ ] 롤백 방법 확인
```

---

## 패턴별 수정 가이드

### Pattern 1: Null Safety 수정

```kotlin
// 문제: NPE 발생
val name = user!!.profile!!.name

// 수정 방법 1: Safe call + Elvis (권장)
val name = user?.profile?.name
    ?: throw UserProfileNotFoundException(userId)

// 수정 방법 2: let 체이닝
val name = user?.let { u ->
    u.profile?.let { p ->
        p.name
    }
} ?: throw UserProfileNotFoundException(userId)

// 수정 방법 3: require/check (사전 조건)
requireNotNull(user) { "User must not be null" }
requireNotNull(user.profile) { "User profile must not be null" }
val name = user.profile.name
```

### Pattern 2: Reactive 수정

```kotlin
// 문제: .block() 사용
fun getUser(id: UUID): User {
    return userRepository.findById(id).block()!!
}

// 수정: suspend 함수로 변환
suspend fun getUser(id: UUID): User {
    return userRepository.findById(id).awaitSingleOrNull()
        ?: throw UserNotFoundException(id)
}

// 주의: 호출부도 함께 수정 필요
// Controller가 suspend가 아니면 함께 수정
```

### Pattern 3: 예외 처리 추가

```kotlin
// 문제: 예외 처리 없이 전파
suspend fun processOrder(orderId: UUID) {
    val order = orderRepository.findById(orderId).awaitSingle()
    // order가 없으면 NoSuchElementException
}

// 수정: 명시적 예외 처리
suspend fun processOrder(orderId: UUID) {
    val order = orderRepository.findById(orderId).awaitSingleOrNull()
        ?: throw OrderNotFoundException(orderId)
    // ...
}
```

### Pattern 4: 트랜잭션 추가

```kotlin
// 문제: 트랜잭션 없이 여러 작업
suspend fun transfer(from: UUID, to: UUID, amount: Long) {
    accountRepository.deduct(from, amount)
    // 여기서 실패하면 데이터 불일치
    accountRepository.add(to, amount)
}

// 수정: @Transactional 추가
@Transactional
suspend fun transfer(from: UUID, to: UUID, amount: Long) {
    accountRepository.deduct(from, amount)
    accountRepository.add(to, amount)
    // 실패 시 전체 롤백
}
```

### Pattern 5: 검증 로직 추가

```kotlin
// 문제: 입력 검증 없음
suspend fun createPost(request: CreatePostRequest): Post {
    val post = Post(title = request.title, content = request.content)
    return postRepository.save(post).awaitSingle()
}

// 수정: 사전 검증 추가
suspend fun createPost(request: CreatePostRequest): Post {
    require(request.title.isNotBlank()) { "Title must not be blank" }
    require(request.title.length <= 200) { "Title must be 200 characters or less" }
    require(request.content.isNotBlank()) { "Content must not be blank" }

    val post = Post(title = request.title.trim(), content = request.content.trim())
    return postRepository.save(post).awaitSingle()
}
```

---

## 수정 후 검증

### 단계별 검증

```bash
# 1. 컴파일 확인
./gradlew compileKotlin

# 2. 관련 테스트 실행
./gradlew test --tests "*{ClassName}*"

# 3. 전체 테스트 실행
./gradlew test

# 4. 코드 스타일 확인
./gradlew ktlintCheck

# 5. Reactive 패턴 확인
grep -rn "\.block()" src/main --include="*.kt"
```

### 수정 확인 체크리스트

```markdown
## 수정 완료 확인

- [ ] 원래 버그가 해결되었는가?
- [ ] 새로운 버그를 도입하지 않았는가?
- [ ] 기존 테스트가 모두 통과하는가?
- [ ] 팀 코딩 표준을 준수하는가?
- [ ] Reactive 패턴을 준수하는가?
- [ ] 적절한 예외 처리가 되어 있는가?
```

---

## 커밋 메시지 패턴

### 버그 수정

```bash
# 일반 버그 수정
git commit -m "🐛 #123 Fix null pointer in UserService.getProfile"

# 긴급 수정
git commit -m "🚑 #123 Hotfix: Fix payment processing failure"

# 보안 수정
git commit -m "🔒 #123 Fix SQL injection vulnerability in search"
```

### 커밋 메시지 템플릿

```text
🐛 #{issue_number} Fix {brief_description}

## Problem
{what_was_wrong}

## Solution
{how_it_was_fixed}

## Testing
{how_it_was_tested}
```

---

## 롤백 패턴

### 즉시 롤백

```bash
# 마지막 커밋 취소 (아직 푸시 안 했을 때)
git reset --soft HEAD~1

# 특정 파일만 되돌리기
git checkout HEAD~1 -- path/to/file.kt
```

### 푸시 후 롤백

```bash
# Revert 커밋 생성
git revert HEAD
git push

# 또는 이전 버전으로 새 커밋
git checkout {previous_commit} -- path/to/file.kt
git commit -m "🔙 Revert changes to {file}"
```

---

## 자주 하는 실수

### 1. 수정 범위 확대

```text
❌ 버그 수정하면서 "ついでに" 리팩토링
→ PR 리뷰 어려움, 롤백 어려움

✅ 버그 수정만 별도 커밋
→ 리팩토링은 별도 이슈/PR로
```

### 2. 테스트 없이 수정

```text
❌ "간단한 수정"이라 테스트 생략
→ 회귀 버그 발생

✅ 아무리 작은 수정도 테스트 실행
./gradlew test
```

### 3. 로컬에서만 확인

```text
❌ 로컬에서 동작해서 바로 푸시
→ CI/CD에서 실패

✅ CI/CD와 동일한 환경에서 검증
./gradlew ktlintCheck compileKotlin test
```
