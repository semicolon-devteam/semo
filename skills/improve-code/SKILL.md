---
name: improve-code
description: |
  코드 품질, 성능, 유지보수성 개선. Use when:
  (1) 코드 품질 개선 요청, (2) 성능 최적화 요청,
  (3) 리팩토링 요청, (4) 기술 부채 해소.
tools: [Read, Glob, Grep, Edit, Bash]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: improve-code 호출 - {개선 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# improve-code Skill

> Spring Boot + Kotlin + WebFlux 환경 코드 개선 Skill

## Purpose

기존 코드의 품질, 성능, 유지보수성을 체계적으로 개선합니다.

### 개선 유형

| 유형 | 설명 | 트리거 키워드 |
|------|------|---------------|
| **quality** | 코드 품질, 가독성, 구조 | 품질, 깔끔하게, 정리 |
| **performance** | 성능 최적화, 병목 해소 | 성능, 빠르게, 최적화 |
| **reactive** | Reactive 패턴 개선 | reactive, 비동기, 스트림 |
| **security** | 보안 취약점 개선 | 보안, 취약점, 인증 |

## Quick Start

```bash
# 1. 대상 파일/디렉토리 분석
# 2. 개선점 식별
# 3. 변경 제안 및 확인
# 4. 개선 적용
# 5. 검증 (lint, test)
```

## Workflow

### Phase 1: 분석

```text
대상 코드 로드
    ↓
코드 스멜 탐지 (references/code-smells.md 참조)
    ↓
개선 기회 목록 생성
```

### Phase 2: 계획

```text
개선 항목 우선순위 결정
├─ Critical: 즉시 개선 필요 (보안, 심각한 버그 가능성)
├─ High: 권장 개선 (성능, 가독성)
├─ Medium: 선택적 개선 (스타일, 일관성)
└─ Low: 나중에 개선 (문서화, 주석)
```

### Phase 3: 실행

```text
개선 적용 (우선순위 순)
    ↓
각 변경 후 검증
├─ lint: ktlint
├─ compile: ./gradlew compileKotlin
└─ test: 관련 테스트 실행
```

### Phase 4: 검증

```text
전체 품질 체크
├─ ./gradlew ktlintCheck
├─ ./gradlew compileKotlin
└─ ./gradlew test (변경 범위에 따라)
```

## Kotlin/Spring 특화 개선 패턴

### 1. Null Safety 개선

```kotlin
// Before: Java-style null check
fun process(data: Data?) {
    if (data != null) {
        doSomething(data)
    }
}

// After: Kotlin idiomatic
fun process(data: Data?) {
    data?.let { doSomething(it) }
}
```

### 2. Reactive 패턴 개선

```kotlin
// Before: Blocking in reactive
fun getData(): Mono<Data> {
    val result = blockingCall()  // BAD
    return Mono.just(result)
}

// After: Non-blocking
fun getData(): Mono<Data> {
    return Mono.fromCallable { blockingCall() }
        .subscribeOn(Schedulers.boundedElastic())
}
```

### 3. 함수형 스타일 개선

```kotlin
// Before: Imperative
val results = mutableListOf<Result>()
for (item in items) {
    if (item.isValid) {
        results.add(transform(item))
    }
}

// After: Functional
val results = items
    .filter { it.isValid }
    .map { transform(it) }
```

## Output Format

### 개선 제안

```markdown
[SAX] Skill: improve-code 분석 완료

## 개선 기회 ({n}건)

### Critical (즉시)
- [ ] `UserService.kt:45` - Blocking call in reactive chain

### High (권장)
- [ ] `PostRepository.kt:23` - N+1 쿼리 가능성
- [ ] `AuthController.kt:67` - 중복 검증 로직

### Medium (선택)
- [ ] 전체: 일관되지 않은 네이밍 컨벤션

## 진행 여부 확인
개선을 진행할까요? (전체 / 선택적 / 취소)
```

### 개선 완료

```markdown
[SAX] Skill: improve-code 완료

## 적용된 개선

✅ **Critical** (1/1)
- `UserService.kt:45` → subscribeOn 추가

✅ **High** (2/2)
- `PostRepository.kt:23` → JOIN FETCH 적용
- `AuthController.kt:67` → 공통 메서드 추출

## 검증 결과
- ktlint: ✅ 통과
- compile: ✅ 성공
- tests: ✅ 12/12 통과
```

## SAX Message Format

```markdown
[SAX] Skill: improve-code 호출 - {개선 유형}

[SAX] Skill: improve-code 분석 완료 - {n}건 발견

[SAX] Skill: improve-code 적용 중 - {current}/{total}

[SAX] Skill: improve-code 완료 - {적용 건수}건 개선
```

## Error Handling

### 테스트 실패 시

```markdown
⚠️ **개선 후 테스트 실패**

개선 적용 후 일부 테스트가 실패했습니다.

**실패 테스트**:
- `UserServiceTest.shouldReturnUser`

**롤백 여부**: 변경사항을 롤백할까요?
```

### 컴파일 오류 시

```markdown
⚠️ **컴파일 오류 발생**

개선 적용 후 컴파일 오류가 발생했습니다.

**오류 위치**: `UserService.kt:52`
**오류 메시지**: Type mismatch

변경사항을 롤백하고 수동 검토를 권장합니다.
```

## References

- [Code Smells](references/code-smells.md) - Kotlin/Spring 코드 스멜 패턴
- [Improvement Patterns](references/improvement-patterns.md) - 개선 패턴 카탈로그
- [Validation Checklist](references/validation-checklist.md) - 검증 체크리스트
