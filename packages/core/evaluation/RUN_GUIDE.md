# Promptfoo 실행 가이드

> semo-next 파일럿 평가 실행 방법

---

## Prerequisites

### 1. 환경 변수 설정

```bash
# Anthropic API Key 설정
export ANTHROPIC_API_KEY="sk-ant-..."

# 또는 .env 파일 사용
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

### 2. Promptfoo 설치

```bash
# 전역 설치
npm install -g promptfoo

# 또는 npx 사용 (설치 없이)
npx promptfoo --version
```

---

## 실행 방법

### 기본 실행

```bash
cd semo-core

# 평가 실행
npx promptfoo eval --config evaluation/promptfoo.yaml

# 결과를 JSON으로 저장
npx promptfoo eval --config evaluation/promptfoo.yaml --output evaluation/results/latest.json

# 웹 UI로 결과 확인
npx promptfoo view
```

### 특정 테스트만 실행

```bash
# 특정 테스트 케이스만 실행
npx promptfoo eval --config evaluation/promptfoo.yaml --filter-description "React 컴포넌트"

# 특정 프롬프트만 테스트
npx promptfoo eval --config evaluation/promptfoo.yaml --prompts "prompts/code-generation.txt"
```

### CI/CD 환경 실행

```bash
# GitHub Actions에서 사용
npx promptfoo eval \
  --config evaluation/promptfoo.yaml \
  --output evaluation/results/ci-$(date +%Y%m%d).json \
  --no-progress-bar \
  --ci
```

---

## 결과 해석

### Pass@k 메트릭

| 메트릭 | 목표 | 설명 |
|--------|------|------|
| Pass@1 | >70% | 첫 번째 시도 성공률 |
| Pass@3 | >90% | 3회 시도 내 성공률 |
| Pass@5 | >95% | 5회 시도 내 성공률 |

### 결과 파일 구조

```json
{
  "results": {
    "stats": {
      "successes": 4,
      "failures": 1,
      "tokenUsage": {
        "total": 12500,
        "prompt": 2500,
        "completion": 10000,
        "cost": 0.15
      }
    },
    "table": [
      {
        "description": "React 컴포넌트 - loading 상태 추가",
        "pass": true,
        "score": 0.85,
        "latencyMs": 3200
      }
    ]
  }
}
```

### 실패 분석

실패한 테스트 케이스는 다음 정보를 확인:

1. **assertion 실패**: 어떤 assertion이 실패했는지
2. **LLM-rubric 점수**: 0-1 사이 점수, 0.7 미만은 실패
3. **latency**: 타임아웃 발생 여부

---

## 베이스라인 설정

### 초기 베이스라인 (Phase 3.2)

첫 실행 결과를 베이스라인으로 저장:

```bash
# 베이스라인 저장
cp evaluation/results/latest.json evaluation/results/baseline-v1.json
```

### 베이스라인 비교

```bash
# 베이스라인과 비교
npx promptfoo eval \
  --config evaluation/promptfoo.yaml \
  --output evaluation/results/latest.json \
  --compare evaluation/results/baseline-v1.json
```

---

## 트러블슈팅

### API Key 오류

```
Error: ANTHROPIC_API_KEY is not set
```

→ 환경 변수 설정 확인

### Rate Limit

```
Error: Rate limit exceeded
```

→ `maxConcurrency`를 1로 낮추거나 재시도

### Timeout

```
Error: Request timed out
```

→ `defaultTest.assert.latency.threshold` 값 증가

---

## References

- [Promptfoo 공식 문서](https://promptfoo.dev/docs/intro)
- [LLM-as-Judge 프롬프트](./judge-prompts/)
- [메트릭 정의](./metrics.md)
