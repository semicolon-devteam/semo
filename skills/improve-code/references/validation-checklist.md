# Validation Checklist

> 코드 개선 후 검증 체크리스트

## Pre-Improvement Checklist

### 1. 현재 상태 스냅샷

```bash
# Git 상태 확인
git status
git stash  # 필요시 현재 변경사항 보존

# 현재 테스트 상태 기록
./gradlew test --info > pre-improvement-test.log

# 현재 lint 상태 기록
./gradlew ktlintCheck > pre-improvement-lint.log
```

### 2. 영향 범위 분석

| 확인 항목 | 명령어 |
|----------|--------|
| 파일 의존성 | `grep -rn "import.*{ClassName}" src/` |
| 테스트 커버리지 | `./gradlew test jacocoTestReport` |
| 호출 관계 | IDE "Find Usages" 또는 `grep -rn "{methodName}"` |

## Post-Improvement Checklist

### Phase 1: 컴파일 검증

```bash
# Kotlin 컴파일
./gradlew compileKotlin

# 전체 컴파일
./gradlew classes
```

**성공 기준**: `BUILD SUCCESSFUL`

**실패 시**:
- 오류 메시지 분석
- 변경사항 롤백: `git checkout -- <file>`
- 점진적 적용 시도

### Phase 2: Lint 검증

```bash
# ktlint 체크
./gradlew ktlintCheck

# 자동 수정 (가능한 경우)
./gradlew ktlintFormat
```

**성공 기준**: 위반 0건

**허용 예외**:
- 기존에 있던 위반 (개선 범위 외)
- 의도적인 스타일 선택 (문서화 필요)

### Phase 3: 테스트 검증

```bash
# 단위 테스트
./gradlew test

# 특정 테스트만
./gradlew test --tests "*UserServiceTest*"

# 통합 테스트 (있는 경우)
./gradlew integrationTest
```

**성공 기준**: 모든 테스트 통과

**실패 시**:
1. 실패 테스트 분석
2. 개선으로 인한 의도된 변경인지 확인
3. 의도된 변경: 테스트 수정
4. 의도치 않은 변경: 코드 롤백

### Phase 4: 기능 검증 (선택)

```bash
# 로컬 서버 실행
./gradlew bootRun

# 수동 API 테스트
curl http://localhost:8080/api/health
```

## Rollback Procedure

### 단일 파일 롤백

```bash
git checkout -- path/to/file.kt
```

### 전체 롤백

```bash
git stash  # 또는
git checkout .
```

### 선택적 롤백

```bash
# 특정 커밋에서 파일 복원
git checkout HEAD~1 -- path/to/file.kt
```

## Quality Metrics

### 개선 전후 비교 항목

| 메트릭 | 측정 방법 | 목표 |
|--------|----------|------|
| 코드 라인 수 | `wc -l` | 감소 또는 유지 |
| 메서드 복잡도 | Detekt | 10 이하 |
| 테스트 커버리지 | JaCoCo | 유지 또는 증가 |
| lint 위반 | ktlint | 감소 |

### Detekt 메트릭 (선택)

```bash
./gradlew detekt

# 주요 체크 항목
# - ComplexMethod: 복잡도 > 10
# - LongMethod: 라인 > 30
# - LargeClass: 라인 > 200
```

## Verification Report Template

```markdown
## 개선 검증 결과

### 대상
- 파일: `UserService.kt`, `PostController.kt`
- 개선 유형: Quality (메서드 추출)

### 검증 결과

| 항목 | 결과 | 비고 |
|------|------|------|
| 컴파일 | ✅ 성공 | |
| ktlint | ✅ 통과 | |
| 단위 테스트 | ✅ 45/45 | |
| 통합 테스트 | ✅ 12/12 | |

### 메트릭 변화

| 메트릭 | Before | After | 변화 |
|--------|--------|-------|------|
| 메서드 수 | 5 | 8 | +3 (추출) |
| 평균 메서드 라인 | 35 | 15 | -20 ✅ |
| 테스트 커버리지 | 78% | 82% | +4% ✅ |

### 결론
개선 적용 완료. 모든 검증 통과.
```

## Emergency Rollback

**심각한 문제 발생 시:**

```bash
# 1. 즉시 롤백
git reset --hard HEAD~1

# 2. 문제 분석
# - 에러 로그 수집
# - 영향 범위 파악

# 3. 점진적 재적용
# - 작은 단위로 분리
# - 각 단계마다 검증
```
