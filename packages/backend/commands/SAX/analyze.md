---
name: analyze
description: 코드 종합 분석 - analyze-code Skill 호출
---

# /SAX:analyze Command

코드 품질, 보안, 성능, 아키텍처를 종합 분석하는 analyze-code Skill을 호출합니다.

> **SuperClaude 대응**: `/sc:analyze`

## Trigger

- `/SAX:analyze` 명령어
- `/SAX:analyze {경로}`
- `/SAX:analyze --focus {focus}`

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **품질 분석**: 복잡도, 중복, 코드 스멜 탐지
2. **보안 스캔**: OWASP Top 10, 취약점 식별
3. **성능 분석**: N+1, 블로킹, 메모리 이슈
4. **아키텍처 검토**: 레이어 의존성, SOLID 위반

## Action

`/SAX:analyze` 실행 시 `analyze-code` Skill을 호출합니다.

```markdown
[SAX] Skill: analyze-code 호출 - {focus}
```

## Focus Options

| Focus | 설명 | 검사 항목 |
|-------|------|----------|
| `quality` | 코드 품질 | 복잡도, 중복, 스멜 |
| `security` | 보안 취약점 | OWASP, 인증/인가 |
| `performance` | 성능 병목 | N+1, 블로킹, 캐싱 |
| `architecture` | 아키텍처 | 레이어, SOLID |
| `all` | 전체 분석 | 모든 Focus 통합 |

## Depth Options

| Depth | 설명 | 소요 시간 |
|-------|------|----------|
| `quick` | 핵심만 | ~30초 |
| `standard` | 기본 | ~2분 |
| `deep` | 전체 | ~5분 |

## Workflow

### Phase 1: 탐색 (Discover)

```text
파일 탐색
├─ src/main/kotlin/**/*.kt
├─ 언어/프레임워크 감지
└─ 프로젝트 구조 분석
```

### Phase 2: 스캔 (Scan)

```text
Focus별 분석 적용
├─ Quality: 코드 스멜 패턴 검사
├─ Security: 취약점 패턴 검사
├─ Performance: 성능 안티패턴 검사
└─ Architecture: 의존성/구조 검사
```

### Phase 3: 평가 (Evaluate)

```text
발견 항목 우선순위화
├─ Critical: 즉시 수정 필요
├─ High: 빠른 수정 권장
├─ Medium: 계획된 수정
└─ Low: 개선 기회
```

### Phase 4: 보고 (Report)

종합 분석 리포트 생성

## Expected Output

```markdown
[SAX] Skill: analyze-code 완료

## 📊 분석 요약

| Focus | Critical | High | Medium | Low | Score |
|-------|----------|------|--------|-----|-------|
| Quality | 0 | 2 | 5 | 8 | 78/100 |
| Security | 1 | 1 | 3 | 2 | 65/100 |
| Performance | 2 | 3 | 1 | 4 | 62/100 |
| Architecture | 0 | 1 | 2 | 3 | 85/100 |

**전체 점수**: 72.5/100 (Grade: C)

## 🔴 Critical Issues (즉시 수정)

### 1. Security: 하드코딩된 API 키

**위치**: `ExternalApiClient.kt:23`
**위험**: 비밀 노출

```kotlin
val apiKey = "sk-1234567890"  // CRITICAL!
```

**수정**:
```kotlin
@Value("\${external.api.key}")
private lateinit var apiKey: String
```

### 2. Performance: 블로킹 호출

**위치**: `UserService.kt:45`
**영향**: 스레드 블로킹

```kotlin
val user = repository.findById(id).block()  // CRITICAL!
```

**수정**:
```kotlin
suspend fun getUser(id: Long): User =
    repository.findById(id).awaitSingle()
```

## 📋 권장 조치

| 우선순위 | 조치 | Focus |
|----------|------|-------|
| 1 | 환경 변수로 비밀 이동 | Security |
| 2 | `.block()` → 코루틴 변환 | Performance |
| 3 | 메서드 분리 리팩토링 | Quality |

## 다음 단계

- Critical 이슈 해결: `/SAX:improve --focus security`
- 테스트 실행: `/SAX:test`
```

## Usage Examples

```bash
# 전체 분석
/SAX:analyze

# 특정 경로
/SAX:analyze src/main/kotlin/domain/user

# 보안 집중
/SAX:analyze --focus security

# 빠른 분석
/SAX:analyze --depth quick

# 전체 + 상세
/SAX:analyze --focus all --depth deep
```

## Integration

### quality-master 연동

```bash
# 검증 + 분석 모드
/SAX:verify --analyze
```

### improve-code 연동

```bash
# 분석 후 개선
/SAX:analyze && /SAX:improve
```

## Related

- [analyze-code Skill](../../skills/analyze-code/SKILL.md)
- [quality-master Agent](../../agents/quality-master/quality-master.md)
- [improve-code Skill](../../skills/improve-code/SKILL.md)
