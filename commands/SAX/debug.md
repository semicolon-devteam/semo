---
name: debug
description: 버그/에러 분석 - debug-master Agent 호출
---

# /SAX:debug Command

버그 분석, 에러 추적, 근본 원인 식별을 위한 debug-master Agent를 호출합니다.

> **SuperClaude 대응**: `/sc:troubleshoot`

## Trigger

- `/SAX:debug` 명령어
- `/SAX:debug {에러 메시지 또는 파일 경로}`

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **에러 분석**: 에러 메시지, 스택 트레이스 분석
2. **버그 추적**: 버그 재현 및 원인 추적
3. **근본 원인 식별**: 5 Whys 기법으로 근본 원인 파악
4. **수정 제안**: 안전한 수정 방안 제시

## Action

`/SAX:debug` 실행 시 `debug-master` Agent를 호출합니다.

```markdown
[SAX] Agent 위임: debug-master (사유: 버그/에러 분석 요청)
```

## Workflow

### Step 1: 컨텍스트 수집

```text
에러 정보 수집
├─ 에러 메시지 / 스택 트레이스
├─ 관련 파일 및 라인
├─ 재현 조건
└─ 최근 변경 사항
```

### Step 2: 분석 수행

| 분석 유형 | 설명 |
|----------|------|
| Reactive 에러 | 블로킹, 백프레셔, 스케줄러 |
| DB/트랜잭션 | R2DBC, 커넥션 풀, 락 |
| 인증/인가 | JWT, 권한, 세션 |
| 통합 에러 | API 호출, 타임아웃 |

### Step 3: 근본 원인 도출

5 Whys 기법을 적용하여 표면적 원인에서 근본 원인까지 추적합니다.

### Step 4: 수정 제안

안전한 수정 방안을 제시합니다:

- 최소 변경 원칙
- 테스트 가능한 수정
- 회귀 방지 방안

## Expected Output

```markdown
[SAX] Agent: debug-master 분석 완료

## 🔍 에러 분석

**에러 유형**: Reactive - 블로킹 호출
**위치**: `UserService.kt:45`

## 🎯 근본 원인 (5 Whys)

1. Why: 요청 타임아웃 발생
2. Why: 스레드 블로킹
3. Why: `.block()` 호출
4. Why: 동기 API 호출
5. **Root Cause**: Reactive 패턴 미준수

## ✅ 수정 제안

**Before**:
```kotlin
val user = userRepository.findById(id).block()
```

**After**:
```kotlin
suspend fun getUser(id: Long): User =
    userRepository.findById(id).awaitSingle()
```

## 📋 검증 체크리스트

- [ ] 수정 적용
- [ ] 단위 테스트 추가
- [ ] 통합 테스트 확인
```

## Usage Examples

```bash
# 기본 사용
/SAX:debug

# 에러 메시지와 함께
/SAX:debug IllegalStateException: block() is blocking

# 파일 경로와 함께
/SAX:debug src/main/kotlin/UserService.kt:45
```

## Related

- [debug-master Agent](../../agents/debug-master/debug-master.md)
- [load-context Skill](../../skills/load-context/SKILL.md)
