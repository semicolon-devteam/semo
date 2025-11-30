# Verification Scope Reference

## Code Style (ktlint)

### Check Command

```bash
./gradlew ktlintCheck
```

### Common Violations

| Rule | Description |
|------|-------------|
| `no-wildcard-imports` | * import 금지 |
| `no-unused-imports` | 미사용 import |
| `indent` | 들여쓰기 4 spaces |
| `max-line-length` | 120자 제한 |
| `trailing-comma` | 후행 쉼표 |

### Auto-fix

```bash
./gradlew ktlintFormat
```

## Compile Check

### Check Command

```bash
./gradlew compileKotlin
```

### Common Errors

| Error | Fix |
|-------|-----|
| Unresolved reference | import 추가 |
| Type mismatch | 타입 수정 |
| Null safety | ?. 또는 !! 처리 |

## Test Execution

### Full Test

```bash
./gradlew test
```

### Specific Test

```bash
./gradlew test --tests "*.PostRepositoryTest"
./gradlew test --tests "*CommandServiceTest"
```

### With Coverage

```bash
./gradlew test jacocoTestReport
```

## Reactive Pattern Check

### Forbidden Patterns

```bash
# Check for blocking calls
grep -r "\.block()" src/main/ --include="*.kt"
grep -r "blockFirst\|blockLast" src/main/ --include="*.kt"
grep -r "Thread\.sleep" src/main/ --include="*.kt"
```

## Debug Code Check

```bash
# println 검사
grep -r "println" src/main/ --include="*.kt"

# TODO 검사
grep -r "TODO\|FIXME" src/main/ --include="*.kt"

# @Suppress 검사
grep -r "@Suppress" src/main/ --include="*.kt"
```

## Requirements Verification

### Process

1. GitHub 이슈에서 AC 추출
2. 코드에서 구현 여부 확인
3. 매칭 결과 리포트

### Checklist

- [ ] 모든 API endpoint 구현
- [ ] Request/Response 형식 일치
- [ ] 에러 처리 구현
- [ ] 테스트 커버리지 충족
