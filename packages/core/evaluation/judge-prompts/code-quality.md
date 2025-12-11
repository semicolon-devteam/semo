# Code Quality Judge

> LLM-as-Judge 프롬프트: 코드 품질 평가

---

## System Prompt

```
당신은 숙련된 소프트웨어 엔지니어로서 코드 품질을 평가하는 심사관입니다.
주어진 코드를 객관적이고 일관된 기준으로 평가하세요.
```

---

## Evaluation Criteria

### 1. 정확성 (Accuracy) - 40%

코드가 요구사항을 정확히 충족하는지 평가합니다.

| 점수 | 기준 |
|------|------|
| 5 | 모든 요구사항 완벽 충족, 엣지 케이스 처리 |
| 4 | 주요 요구사항 충족, 사소한 누락 |
| 3 | 핵심 기능 구현, 일부 요구사항 누락 |
| 2 | 부분적 구현, 주요 기능 누락 |
| 1 | 요구사항 대부분 미충족 |

### 2. 가독성 (Readability) - 25%

코드를 다른 개발자가 쉽게 이해할 수 있는지 평가합니다.

| 점수 | 기준 |
|------|------|
| 5 | 명확한 변수명, 적절한 주석, 일관된 스타일 |
| 4 | 이해 용이, 사소한 개선점 존재 |
| 3 | 이해 가능하나 리팩토링 필요 |
| 2 | 이해 어려움, 혼란스러운 구조 |
| 1 | 가독성 매우 낮음 |

### 3. 보안성 (Security) - 20%

보안 모범 사례 준수 여부를 평가합니다.

| 점수 | 기준 |
|------|------|
| 5 | 보안 모범 사례 완벽 준수, 취약점 없음 |
| 4 | 일반적인 보안 수준, 사소한 개선점 |
| 3 | 기본 보안 준수, 잠재적 위험 |
| 2 | 보안 취약점 존재 |
| 1 | 심각한 보안 문제 |

### 4. 효율성 (Efficiency) - 15%

성능과 리소스 사용을 평가합니다.

| 점수 | 기준 |
|------|------|
| 5 | 최적화된 알고리즘, 효율적 리소스 사용 |
| 4 | 적절한 성능, 작은 최적화 여지 |
| 3 | 수용 가능한 성능 |
| 2 | 비효율적 구현 |
| 1 | 심각한 성능 문제 |

---

## Evaluation Prompt

```markdown
## 평가 대상

### 요구사항
{{requirements}}

### 제출된 코드
```{{language}}
{{code}}
```

---

## 평가 지침

위 코드를 다음 기준으로 평가하세요:

1. **정확성 (1-5)**: 요구사항 충족도
2. **가독성 (1-5)**: 코드 이해 용이성
3. **보안성 (1-5)**: 취약점 존재 여부
4. **효율성 (1-5)**: 성능 고려

각 항목에 점수와 간단한 이유를 제공하세요.

---

## 출력 형식

반드시 다음 JSON 형식으로 응답하세요:

```json
{
  "scores": {
    "accuracy": <1-5>,
    "readability": <1-5>,
    "security": <1-5>,
    "efficiency": <1-5>
  },
  "total": <합계, 최대 20>,
  "weighted_score": <가중치 적용 점수, 최대 100>,
  "pass": <true/false, weighted_score >= 70>,
  "feedback": {
    "strengths": ["강점 1", "강점 2"],
    "improvements": ["개선점 1", "개선점 2"],
    "critical_issues": ["심각한 문제 (있는 경우)"]
  },
  "summary": "전체 평가 요약 (1-2문장)"
}
```
```

---

## Pass Criteria

| 총점 | 가중 점수 | 판정 | 액션 |
|------|----------|------|------|
| 16-20 | 80-100 | **PASS** | 배포 가능 |
| 14-15 | 70-79 | **PASS (주의)** | 리뷰 후 배포 |
| 12-13 | 60-69 | **WARN** | 수정 후 재평가 |
| <12 | <60 | **FAIL** | 재생성 필요 |

---

## Example Output

```json
{
  "scores": {
    "accuracy": 4,
    "readability": 5,
    "security": 4,
    "efficiency": 4
  },
  "total": 17,
  "weighted_score": 84.5,
  "pass": true,
  "feedback": {
    "strengths": [
      "명확한 TypeScript 타입 정의",
      "적절한 에러 핸들링"
    ],
    "improvements": [
      "로딩 상태 UI 개선 가능",
      "캐싱 전략 추가 권장"
    ],
    "critical_issues": []
  },
  "summary": "요구사항을 잘 충족하는 고품질 코드입니다. 사소한 개선점만 존재합니다."
}
```

---

## Integration with Promptfoo

```yaml
# evaluation/promptfoo.yaml에 추가
tests:
  - description: "코드 품질 평가"
    vars:
      requirements: "React 컴포넌트에 loading 상태 추가"
      code: "{{generated_code}}"
      language: "tsx"
    assert:
      - type: llm-rubric
        value: |
          Use the Code Quality Judge criteria:
          - Accuracy (40%): Does it meet requirements?
          - Readability (25%): Is it easy to understand?
          - Security (20%): Are there vulnerabilities?
          - Efficiency (15%): Is it performant?

          Return pass=true if weighted_score >= 70
```

---

## References

- [Promptfoo LLM-as-Judge](https://promptfoo.dev/docs/configuration/expected-outputs/llm-rubric)
- [SEMO Evaluation Metrics](../metrics.md)
