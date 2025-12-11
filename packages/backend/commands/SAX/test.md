---
name: test
description: 테스트 실행 및 커버리지 - run-tests Skill 호출
---

# /SAX:test Command

테스트 실행, 커버리지 분석, 품질 리포트를 위한 run-tests Skill을 호출합니다.

> **SuperClaude 대응**: `/sc:test`

## Trigger

- `/SAX:test` 명령어
- `/SAX:test {테스트 경로 또는 패턴}`
- `/SAX:test --coverage`

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **테스트 실행**: 단위/통합 테스트 실행
2. **커버리지 분석**: JaCoCo 기반 커버리지 리포트
3. **품질 검증**: 테스트 통과율 확인
4. **회귀 방지**: 변경 후 테스트 검증

## Action

`/SAX:test` 실행 시 `run-tests` Skill을 호출합니다.

```markdown
[SAX] Skill: run-tests 호출 - {scope}
```

## Test Types

| 유형 | 설명 | 명령 |
|------|------|------|
| `unit` | 단위 테스트 | `./gradlew test` |
| `integration` | 통합 테스트 | `./gradlew integrationTest` |
| `all` | 전체 테스트 | `./gradlew test integrationTest` |

## Workflow

### Step 1: 테스트 탐색

```text
테스트 탐색
├─ src/test/kotlin/**/*Test.kt
├─ src/test/kotlin/**/*IntegrationTest.kt
└─ 관련 테스트 필터링
```

### Step 2: 테스트 실행

```bash
# 전체 테스트
./gradlew test --info

# 특정 클래스
./gradlew test --tests "UserServiceTest"

# 커버리지 포함
./gradlew test jacocoTestReport
```

### Step 3: 결과 분석

| 지표 | 기준 |
|------|------|
| 통과율 | 100% 필수 |
| 라인 커버리지 | 80% 권장 |
| 브랜치 커버리지 | 70% 권장 |

## Expected Output

```markdown
[SAX] Skill: run-tests 완료

## 🧪 테스트 결과

| 항목 | 값 |
|------|-----|
| 총 테스트 | 125 |
| 통과 | 123 |
| 실패 | 2 |
| 스킵 | 0 |

**통과율**: 98.4% ❌ (100% 필요)

## ❌ 실패한 테스트

### 1. UserServiceTest.shouldCreateUser

**원인**: Expected 201 but was 400
**위치**: `UserServiceTest.kt:45`

```kotlin
@Test
fun shouldCreateUser() {
    // Assertion failed here
    assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
}
```

**가능한 원인**:
- 검증 로직 변경
- 필수 필드 누락

### 2. PostRepositoryTest.shouldFindByAuthor

**원인**: Timeout after 5000ms
**위치**: `PostRepositoryTest.kt:78`

## 📊 커버리지 리포트

| 패키지 | 라인 | 브랜치 |
|--------|------|--------|
| domain.user | 85% | 72% |
| domain.post | 78% | 65% |
| infrastructure | 62% | 55% |

**전체**: 75% / 64%

## 📋 다음 단계

1. 실패 테스트 수정
2. 커버리지 개선 (infrastructure 패키지)
```

## Usage Examples

```bash
# 전체 테스트
/SAX:test

# 특정 클래스
/SAX:test UserServiceTest

# 특정 패키지
/SAX:test domain.user

# 커버리지 포함
/SAX:test --coverage

# 통합 테스트만
/SAX:test --integration
```

## Related

- [run-tests Skill](../../skills/run-tests/SKILL.md)
- [quality-master Agent](../../agents/quality-master/quality-master.md)
- [improve-code Skill](../../skills/improve-code/SKILL.md)
