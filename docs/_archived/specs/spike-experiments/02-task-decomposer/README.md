# SPIKE-02-01: Task Decomposer 정확도 테스트

> 자연어 요청의 Job 분해 정확도 검증 및 프롬프트 최적화

---

## 실험 목적

Task Decomposer는 사용자 요청을 역할별 Job으로 분해하는 핵심 컴포넌트입니다.
이 Spike는 다음을 검증합니다:

1. **역할 매칭 정확도**: 올바른 역할에 Job 할당
2. **의존성 추론 정확도**: Job 간 의존성 관계 파악
3. **Few-shot 예제 최적화**: 예제 개수에 따른 정확도 변화
4. **프로젝트 컨텍스트 효과**: package.json, 디렉토리 구조 제공 시 개선도

---

## 성공 기준

| 지표 | 목표 | Critical |
|------|------|----------|
| 역할 매칭 정확도 | > 80% | ✅ 필수 |
| 의존성 추론 정확도 | > 85% | ✅ 필수 |
| 분해 실패율 | < 10% | ⚠️ 중요 |
| Token 사용량 | < 10k/분해 | ⚠️ 중요 |

---

## 실험 환경

### 요구 사항

- Node.js 18+
- Anthropic API Key
- `.env` 파일:
  ```
  ANTHROPIC_API_KEY=your-api-key
  ```

### 설치

```bash
cd specs/spike-experiments/02-task-decomposer
npm install
```

---

## 테스트 샘플

### 샘플 요청 (10개)

#### 레벨 1: 간단 (명확한 요구사항)

1. **"로그인 페이지 만들어줘"**
   - 예상 Job: FE (로그인 UI), BE (인증 API), QA (로그인 테스트)
   - 예상 의존성: BE → FE, FE → QA

2. **"사용자 프로필 조회 API"**
   - 예상 Job: BE (API 구현), QA (API 테스트)
   - 예상 의존성: BE → QA

3. **"README 문서 작성"**
   - 예상 Job: PO (문서 작성)
   - 예상 의존성: 없음

#### 레벨 2: 중간 (다소 애매한 요구사항)

4. **"사용자 관리 기능"**
   - 예상 Job: PO (요구사항), Architect (설계), FE (CRUD UI), BE (CRUD API), QA (통합 테스트)
   - 예상 의존성: PO → Architect, Architect → FE/BE, FE/BE → QA

5. **"결제 시스템 연동"**
   - 예상 Job: Architect (결제 게이트웨이 선택), BE (연동 구현), FE (결제 UI), QA (결제 플로우 테스트)
   - 예상 의존성: Architect → BE, BE → FE, FE → QA

6. **"성능 최적화"**
   - 예상 Job: Architect (병목 분석), FE (프론트 최적화), BE (백엔드 최적화), DevOps (인프라 튜닝)
   - 예상 의존성: Architect → FE/BE/DevOps

#### 레벨 3: 복잡 (모호한 요구사항)

7. **"커뮤니티 기능 추가"**
   - 예상 Job: PO (요구사항 명확화), Architect (아키텍처 설계), FE (게시판/댓글 UI), BE (게시판 API), QA (커뮤니티 테스트), DevOps (파일 업로드 인프라)
   - 예상 의존성: 복잡한 DAG

8. **"서비스 리팩토링"**
   - 예상 Job: Architect (리팩토링 전략), FE (컴포넌트 리팩토링), BE (서비스 레이어 리팩토링), QA (회귀 테스트)
   - 예상 의존성: Architect → FE/BE, FE/BE → QA

9. **"실시간 알림 시스템"**
   - 예상 Job: Architect (WebSocket vs SSE), BE (알림 서버), FE (알림 UI), DevOps (인프라), QA (실시간 테스트)
   - 예상 의존성: Architect → BE/DevOps, BE → FE, 모두 → QA

10. **"모바일 앱 개발"**
    - 예상 Job: PO (앱 기획), Architect (앱 아키텍처), FE (React Native), BE (API 조정), DevOps (앱 배포 파이프라인), QA (모바일 테스트)
    - 예상 의존성: 복잡한 DAG

---

## 실험 시나리오

### Test 1: Few-shot 예제 개수 비교

**목적**: 예제 개수에 따른 정확도 측정

**절차**:
```bash
npm run test:few-shot
```

**변수**:
- Few-shot 예제: 0개, 3개, 5개, 10개

**측정**:
- 역할 매칭 정확도
- 의존성 추론 정확도
- Token 사용량

### Test 2: 프로젝트 컨텍스트 효과

**목적**: package.json, 디렉토리 구조 제공 시 개선도

**절차**:
```bash
npm run test:context
```

**변수**:
- 최소 컨텍스트 (프로젝트명만)
- package.json 포함
- 디렉토리 구조 포함
- Full 컨텍스트 (package.json + 디렉토리 + README)

### Test 3: 분해 프롬프트 A/B 테스트

**목적**: 프롬프트 템플릿 비교

**절차**:
```bash
npm run test:prompts
```

**버전**:
- Version A: 간결한 프롬프트
- Version B: 상세한 지침 포함
- Version C: Few-shot 예제 강조

---

## 평가 방법

### 자동 평가

각 샘플에 대해 **정답 데이터**(ground truth)를 준비:

```json
{
  "request": "로그인 페이지 만들어줘",
  "expected": {
    "jobs": [
      { "role": "FE", "description": "로그인 UI 구현" },
      { "role": "BE", "description": "인증 API 구현" },
      { "role": "QA", "description": "로그인 테스트" }
    ],
    "dependencies": [
      { "from": "BE", "to": "FE" },
      { "from": "FE", "to": "QA" }
    ]
  }
}
```

**정확도 계산**:
```typescript
// 역할 매칭 정확도
roleAccuracy = correctRoles / totalJobs

// 의존성 정확도
dependencyAccuracy = correctDependencies / totalDependencies

// 전체 점수
totalScore = (roleAccuracy * 0.6) + (dependencyAccuracy * 0.4)
```

### 수동 검토

자동 평가 결과를 사람이 검토:
- False Positive (과다 분해)
- False Negative (과소 분해)
- 합리적 대안 (정답과 다르지만 수용 가능)

---

## 예상 결과

### ✅ 성공 시나리오 (Few-shot 5개)

```
=== Task Decomposer 정확도 테스트 ===

샘플 결과:
  1. 로그인 페이지: 100% (3/3 역할, 2/2 의존성)
  2. 프로필 API: 100% (2/2 역할, 1/1 의존성)
  3. README: 100% (1/1 역할, 0/0 의존성)
  ...
  10. 모바일 앱: 83% (5/6 역할, 7/9 의존성)

전체 통계:
  역할 매칭 정확도: 87%
  의존성 정확도: 91%
  분해 실패: 0/10
  평균 Token: 8,234

판정: ✅ 성공 (목표치 초과)
```

### ❌ 실패 시나리오

```
역할 매칭 정확도: 68%
의존성 정확도: 72%
분해 실패: 3/10

판정: ❌ 실패
→ 대안: 역할 선택 UI 추가
```

---

## 개선 전략

### 전략 1: Few-shot 예제 최적화

실험 결과 기반으로 최적 예제 선정:
- 간단/중간/복잡 케이스 각 1~2개
- 총 5개 예제

### 전략 2: 프롬프트 개선

```markdown
# 개선 전
"Break down this task into jobs."

# 개선 후
"Analyze the task and identify which roles are needed:
- PO: Requirements, planning
- Architect: Technical design
- FE: Frontend implementation
- BE: Backend implementation
- QA: Testing
- DevOps: Infrastructure

For each job, specify dependencies (which jobs must complete first)."
```

### 전략 3: 체인 프롬프팅

```typescript
// Step 1: 역할 식별
const roles = await identifyRoles(request);

// Step 2: 각 역할별 작업 정의
const jobs = await defineJobs(request, roles);

// Step 3: 의존성 추론
const dependencies = await inferDependencies(jobs);
```

---

## 대안 (NO-GO 시)

### 대안 1: 역할 선택 UI

사용자가 먼저 역할을 선택:
```
[x] FE  [ ] BE  [x] QA  [ ] DevOps
"로그인 페이지 UI와 테스트 작성"
```

### 대안 2: 템플릿 기반

자주 사용하는 패턴을 템플릿으로:
- "CRUD API 구현" → FE + BE + QA
- "새 페이지 추가" → FE + QA
- "인프라 설정" → DevOps

### 대안 3: 사용자 수정 인터페이스

분해 결과를 드래그 앤 드롭으로 수정:
```
[FE] 로그인 UI      [BE] 인증 API
       ↓                  ↓
[QA] 로그인 테스트
```

---

## Next Steps

1. ✅ 테스트 샘플 준비 (10개)
2. ⏳ Ground truth 작성
3. ⏳ Few-shot 예제 초안 작성
4. ⏳ 실험 실행
5. ⏳ 결과 분석 및 프롬프트 튜닝
