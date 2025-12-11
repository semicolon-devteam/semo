# 패턴 분류 상세 가이드

> PR 피드백을 학습 가능한 패턴으로 분류하는 방법

---

## 분류 체계

### 1단계: 카테고리 분류

| 카테고리 | 설명 | 우선순위 |
|----------|------|----------|
| **Security** | 보안 관련 문제 | P0 |
| **Code Quality** | 코드 품질 문제 | P1 |
| **Architecture** | 아키텍처/설계 문제 | P1 |
| **Style** | 코딩 스타일 문제 | P2 |
| **Documentation** | 문서화 문제 | P3 |

### 2단계: 패턴 식별

#### Security 패턴

| 패턴 ID | 키워드 | 예시 피드백 |
|---------|--------|-------------|
| `security-vulnerability` | XSS, SQL injection, CSRF | "사용자 입력을 이스케이프 하세요" |
| `hardcoded-secret` | token, password, key | "API 키가 하드코딩되어 있습니다" |
| `insecure-dependency` | vulnerable, CVE | "이 패키지에 보안 취약점이 있습니다" |

#### Code Quality 패턴

| 패턴 ID | 키워드 | 예시 피드백 |
|---------|--------|-------------|
| `missing-error-handling` | try-catch, error, 에러 처리 | "에러 처리가 없습니다" |
| `missing-type-annotation` | 타입, type, TypeScript | "타입을 명시해주세요" |
| `missing-loading-state` | loading, 로딩, spinner | "로딩 상태가 없습니다" |
| `missing-empty-state` | empty, 빈 상태, no data | "데이터가 없을 때 처리가 없습니다" |
| `missing-validation` | validate, 검증, 유효성 | "입력 검증이 필요합니다" |

#### Architecture 패턴

| 패턴 ID | 키워드 | 예시 피드백 |
|---------|--------|-------------|
| `component-too-large` | 분리, 너무 큼, 리팩토링 | "컴포넌트가 너무 큽니다. 분리하세요" |
| `prop-drilling` | prop drilling, context | "prop이 너무 깊이 전달됩니다" |
| `missing-memoization` | memo, useMemo, useCallback | "리렌더링 최적화가 필요합니다" |
| `circular-dependency` | circular, 순환 | "순환 의존성이 있습니다" |

#### Style 패턴

| 패턴 ID | 키워드 | 예시 피드백 |
|---------|--------|-------------|
| `inconsistent-naming` | 네이밍, naming, camelCase | "네이밍 규칙을 따라주세요" |
| `magic-number` | magic number, 상수, const | "매직 넘버를 상수로 추출하세요" |
| `code-duplication` | 중복, duplicate, DRY | "중복 코드가 있습니다" |

---

## 분류 알고리즘

### 키워드 매칭 (1차)

```javascript
const patternKeywords = {
  'missing-error-handling': ['try', 'catch', 'error', '에러', '예외'],
  'missing-type-annotation': ['type', '타입', 'TypeScript', 'any'],
  'missing-loading-state': ['loading', '로딩', 'spinner', 'pending'],
  // ...
};

function matchPattern(comment) {
  for (const [pattern, keywords] of Object.entries(patternKeywords)) {
    if (keywords.some(kw => comment.toLowerCase().includes(kw.toLowerCase()))) {
      return pattern;
    }
  }
  return null;
}
```

### LLM 분류 (2차)

키워드 매칭 실패 시 LLM 사용:

```markdown
## 프롬프트

다음 PR 리뷰 코멘트를 분석하여 가장 적합한 패턴을 선택하세요.

### 코멘트
{{comment}}

### 코드 (해당 시)
{{code_snippet}}

### 패턴 옵션
1. missing-error-handling - 에러/예외 처리 누락
2. missing-type-annotation - TypeScript 타입 누락
3. missing-loading-state - 로딩 상태 누락
4. missing-empty-state - 빈 상태 처리 누락
5. security-vulnerability - 보안 취약점
6. inconsistent-naming - 네이밍 규칙 불일치
7. component-too-large - 컴포넌트 크기 초과
8. other - 위 패턴에 해당하지 않음

### 출력
{
  "pattern_id": "선택한 패턴 ID",
  "confidence": 0.0-1.0 사이 확신도,
  "reasoning": "선택 이유"
}
```

### 신뢰도 임계값

| 신뢰도 | 처리 |
|--------|------|
| ≥ 0.8 | 자동 분류 |
| 0.5 - 0.8 | 분류 + 리뷰 플래그 |
| < 0.5 | 'other'로 분류, 수동 리뷰 필요 |

---

## 예시 추출

### 좋은 예시 / 나쁜 예시 추출

```markdown
## 프롬프트

다음 피드백에서 Bad/Good 코드 예시를 추출하세요.

### 피드백
{{comment}}

### 변경 전 코드
{{before_code}}

### 변경 후 코드 (있다면)
{{after_code}}

### 출력
{
  "bad_example": "문제가 있는 코드",
  "good_example": "수정된 코드",
  "explanation": "왜 이렇게 수정해야 하는지"
}
```

### 예시 품질 기준

| 기준 | 설명 |
|------|------|
| **간결성** | 3-10줄 이내 |
| **독립성** | 컨텍스트 없이 이해 가능 |
| **대표성** | 패턴을 잘 보여줌 |
| **차별성** | bad/good 차이가 명확 |

---

## 빈도 분석

### 빈도 계산

```javascript
// 시간 가중 빈도 (최근 피드백에 높은 가중치)
function calculateFrequency(feedbacks) {
  const now = new Date();
  return feedbacks.reduce((sum, fb) => {
    const daysSince = (now - new Date(fb.created_at)) / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-daysSince / 30); // 30일 반감기
    return sum + weight;
  }, 0);
}
```

### 임계값 설정

| 패턴 유형 | 기본 임계값 | 조정 가능 |
|-----------|------------|-----------|
| Security | 1 | ❌ (항상 즉시 알림) |
| Code Quality | 3 | ✅ |
| Architecture | 2 | ✅ |
| Style | 5 | ✅ |

---

## Few-shot 프롬프트 생성

### 프롬프트 주입 형식

```markdown
⚠️ 다음 패턴에서 자주 실수가 발생합니다:

### 1. {{pattern_name}} (빈도: {{frequency}})

**Bad:**
```{{language}}
{{bad_example}}
```

**Good:**
```{{language}}
{{good_example}}
```

**이유:** {{explanation}}
```

### 패턴 선택 기준

Few-shot에 포함할 패턴 선택:

1. 빈도 상위 3개
2. 최근 7일 내 발생한 패턴
3. 현재 작업 컨텍스트와 관련된 패턴

---

## References

- [feedback-collector Skill](../SKILL.md)
- [Self-Learning RAG 설계](../../../rag/feedback-index.md)
