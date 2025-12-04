---
name: improve
description: 코드 개선/리팩토링 - improve-code Skill 호출
---

# /SAX:improve Command

코드 품질, 성능, 유지보수성 개선을 위한 improve-code Skill을 호출합니다.

> **SuperClaude 대응**: `/sc:improve`

## Trigger

- `/SAX:improve` 명령어
- `/SAX:improve {파일 경로}`
- `/SAX:improve --focus {focus}`

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **코드 품질 개선**: 코드 스멜 제거, 가독성 향상
2. **성능 최적화**: 병목 해결, 효율성 개선
3. **유지보수성 향상**: 리팩토링, 구조 개선
4. **보안 강화**: 취약점 수정, 안전한 패턴 적용

## Action

`/SAX:improve` 실행 시 `improve-code` Skill을 호출합니다.

```markdown
[SAX] Skill: improve-code 호출 - {focus}
```

## Focus Options

| Focus | 설명 | 개선 항목 |
|-------|------|----------|
| `quality` | 코드 품질 | 복잡도, 중복, 네이밍 |
| `performance` | 성능 | N+1, 블로킹, 캐싱 |
| `maintainability` | 유지보수성 | 구조, 의존성, 테스트 |
| `security` | 보안 | 취약점, 인증, 암호화 |
| `all` | 전체 | 모든 항목 통합 |

## Workflow

### Step 1: 대상 분석

```text
코드 분석
├─ 파일/모듈 스캔
├─ 코드 스멜 탐지
├─ 개선 기회 식별
└─ 우선순위 결정
```

### Step 2: 개선안 도출

| 우선순위 | 기준 |
|----------|------|
| Critical | 즉시 수정 필요 |
| High | 빠른 수정 권장 |
| Medium | 계획된 수정 |
| Low | 선택적 개선 |

### Step 3: 개선 적용

안전한 리팩토링 절차:

1. 테스트 확인
2. 점진적 변경
3. 검증
4. 커밋

## Expected Output

```markdown
[SAX] Skill: improve-code 완료

## 📊 분석 결과

| 항목 | 발견 | 수정 |
|------|------|------|
| 코드 스멜 | 5 | 5 |
| 성능 이슈 | 2 | 2 |
| 보안 문제 | 1 | 1 |

## ✅ 적용된 개선

### 1. 복잡도 감소 (High)

**파일**: `UserService.kt`

**Before**:
```kotlin
fun processUser(user: User): Result {
    if (user.isActive) {
        if (user.hasPermission) {
            // 깊은 중첩...
        }
    }
}
```

**After**:
```kotlin
fun processUser(user: User): Result {
    if (!user.isActive) return Result.inactive()
    if (!user.hasPermission) return Result.forbidden()
    // 평탄화된 로직
}
```

### 2. N+1 쿼리 해결 (Critical)

**파일**: `PostRepository.kt`

- `@BatchSize(100)` 적용
- JOIN FETCH 쿼리 추가

## 📋 다음 단계

- [ ] 테스트 실행: `/SAX:test`
- [ ] 분석 검증: `/SAX:analyze`
```

## Usage Examples

```bash
# 전체 개선
/SAX:improve

# 특정 파일
/SAX:improve src/main/kotlin/UserService.kt

# 성능 집중
/SAX:improve --focus performance

# 보안 집중
/SAX:improve --focus security
```

## Related

- [improve-code Skill](../../skills/improve-code/SKILL.md)
- [analyze-code Skill](../../skills/analyze-code/SKILL.md)
- [run-tests Skill](../../skills/run-tests/SKILL.md)
