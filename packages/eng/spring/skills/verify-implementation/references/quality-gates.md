# Quality Gates Reference

## Gate Pipeline

```text
Source Code
    ↓
[ktlintCheck] → Style 검증
    ↓
[compileKotlin] → 컴파일 검증
    ↓
[verify-reactive] → Reactive 검증
    ↓
[test] → 테스트 실행
    ↓
[jacocoTestReport] → 커버리지
    ↓
✅ PR Ready
```

## Gate Details

### 1. ktlintCheck

```bash
./gradlew ktlintCheck
```

검사 항목:
- 코드 스타일
- 임포트 정렬
- 네이밍 컨벤션

### 2. compileKotlin

```bash
./gradlew compileKotlin
```

검사 항목:
- 타입 검사
- null safety
- 문법 오류

### 3. verify-reactive

검사 항목:
- `.block()` 호출 없음
- suspend fun 패턴
- Flow 패턴

### 4. test

```bash
./gradlew test
```

검사 항목:
- 단위 테스트
- 통합 테스트
- Testcontainers

### 5. jacocoTestReport

```bash
./gradlew jacocoTestReport
```

목표:
- Line Coverage: ≥80%
- Branch Coverage: ≥70%

## 실패 시 대응

| Gate | 실패 원인 | 해결 |
|------|----------|------|
| ktlintCheck | 스타일 위반 | `./gradlew ktlintFormat` |
| compileKotlin | 타입 오류 | IDE에서 수정 |
| verify-reactive | .block() | awaitSingle로 변경 |
| test | 테스트 실패 | 테스트 또는 코드 수정 |
| coverage | 커버리지 부족 | 테스트 추가 |
