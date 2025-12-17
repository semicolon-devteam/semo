# Diagnostic Workflow Reference

> debug-master의 상세 진단 워크플로우

## Phase 1: 증상 수집 (Symptom Collection)

### 에러 메시지 수집

```bash
# 최근 로그 확인
./gradlew bootRun 2>&1 | tail -100

# 특정 에러 패턴 검색
grep -r "Exception" logs/ --include="*.log"
```

### 스택 트레이스 분석

```text
분석 포인트:
1. Exception 타입 확인
2. "Caused by" 체인 추적
3. 프로젝트 코드 라인 식별 (com.semicolon.*)
4. 프레임워크 코드 vs 비즈니스 코드 구분
```

### 재현 조건 파악

```markdown
## 재현 정보 체크리스트
- [ ] API 엔드포인트:
- [ ] HTTP 메서드:
- [ ] 요청 페이로드:
- [ ] 인증 상태:
- [ ] 발생 빈도: (항상/간헐적)
- [ ] 환경: (로컬/개발/운영)
```

---

## Phase 2: 컨텍스트 파악 (Context Analysis)

### 관련 코드 파일 식별

```bash
# 에러 발생 파일 기준 관련 파일 찾기
# Controller → Service → Repository 체인 추적

# 예: PostController 에러 시
grep -r "PostController" src/main --include="*.kt" -l
grep -r "PostService" src/main --include="*.kt" -l
grep -r "PostRepository" src/main --include="*.kt" -l
```

### 최근 변경 이력 확인

```bash
# 해당 파일 최근 변경
git log --oneline -10 -- {file_path}

# 최근 전체 변경
git log --oneline -20

# 변경 내용 확인
git diff HEAD~5 -- {file_path}
```

### Spec 문서 참조

```bash
# 관련 도메인 spec 확인
ls specs/{domain}/
cat specs/{domain}/spec.md
```

---

## Phase 3: Root Cause 분석

### 가설 수립 프로세스

```text
1. 에러 메시지에서 힌트 추출
2. 가능한 원인 목록 작성 (최대 3개)
3. 각 가설별 검증 방법 정의
4. 순차적 검증 실행
```

### 코드 추적 패턴

```text
Forward Tracing (입력 → 출력):
Request → Controller → Service → Repository → DB

Backward Tracing (에러 → 원인):
Exception → 발생 지점 → 호출자 → 데이터 흐름
```

### 원인 확정 기준

```markdown
✅ 확정 조건:
- 코드에서 문제 지점 명확히 식별
- 재현 가능
- 수정 시 해결됨을 예측 가능

❌ 미확정 시:
- 추가 로그 삽입 요청
- 더 많은 컨텍스트 수집
- 사용자에게 추가 정보 요청
```

---

## Phase 4: 수정안 제시

### 수정 코드 작성 원칙

```text
1. 최소 침습적 수정 (Minimal Change)
2. 기존 패턴 유지
3. 팀 코딩 표준 준수
4. Reactive 패턴 준수 (.block() 금지)
```

### 영향 범위 분석

```bash
# 수정 대상 파일이 사용되는 곳 확인
grep -r "ClassName" src/ --include="*.kt" -l

# 테스트 파일 확인
ls src/test/**/\*{ClassName}*
```

### 테스트 방안 정의

```markdown
## 테스트 체크리스트
- [ ] 단위 테스트 추가/수정
- [ ] 기존 테스트 통과 확인
- [ ] 통합 테스트 필요 여부
- [ ] 수동 테스트 시나리오
```

---

## Phase 5: 수정 적용 (--fix 모드)

### 안전한 수정 절차

```bash
# 1. 현재 상태 백업
git stash

# 2. 수정 적용
# (edit_file 사용)

# 3. 컴파일 확인
./gradlew compileKotlin

# 4. 테스트 실행
./gradlew test --tests "*{TestClass}*"

# 5. 전체 검증
./gradlew ktlintCheck compileKotlin test
```

### 롤백 준비

```bash
# 수정 실패 시 롤백
git checkout -- {modified_files}
# 또는
git stash pop
```

---

## Error Type별 진단 가이드

### Compile Error

```text
진단 순서:
1. 에러 메시지에서 파일:라인 확인
2. 해당 라인 직접 확인
3. 타입 불일치/누락 import 등 확인
4. 즉시 수정
```

### Runtime Exception

```text
진단 순서:
1. 스택 트레이스 전체 확인
2. "Caused by" 체인 추적
3. 프로젝트 코드 첫 등장 지점 확인
4. 해당 코드의 입력값 검증
5. Null/빈값/잘못된 타입 확인
```

### Reactive Error

```text
진단 순서:
1. Reactive 스트림 체인 확인
2. 구독(subscribe) 여부 확인
3. 에러 핸들링(onError) 확인
4. .block() 사용 여부 검사
5. 코루틴 컨텍스트 확인
```

### Integration Error

```text
진단 순서:
1. 외부 시스템 연결 상태 확인
2. 설정값 (URL, 인증) 확인
3. 네트워크/방화벽 확인
4. 타임아웃 설정 확인
5. 재시도 로직 확인
```
