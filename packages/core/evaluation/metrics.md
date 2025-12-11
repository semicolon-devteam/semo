# SEMO Agentic Evaluation Metrics

> Agent/Skill 품질 측정을 위한 메트릭 정의

---

## Pass@k 메트릭

| 메트릭 | 설명 | 목표 | 현재 |
|--------|------|------|------|
| **Pass@1** | 첫 시도 성공률 | >70% | TBD |
| **Pass@3** | 3회 내 성공률 | >90% | TBD |
| **Pass@5** | 5회 내 성공률 | >95% | TBD |

### 측정 방법

```bash
# Pass@k 계산
npx promptfoo eval --config evaluation/promptfoo.yaml --repeat 5 --output results.json
```

---

## 품질 메트릭

### 1. 정확성 (Accuracy)

| 항목 | 설명 | 가중치 |
|------|------|--------|
| 요구사항 충족 | 명시된 기능 구현 여부 | 40% |
| 타입 안전성 | TypeScript 타입 오류 없음 | 30% |
| 런타임 오류 | 실행 시 에러 없음 | 30% |

### 2. 코드 품질 (Code Quality)

| 항목 | 설명 | 측정 방법 |
|------|------|----------|
| 가독성 | 코드 이해 용이성 | LLM-as-Judge |
| 유지보수성 | 수정 용이성 | 복잡도 분석 |
| 일관성 | 프로젝트 스타일 준수 | ESLint 규칙 |

### 3. 성능 (Performance)

| 항목 | 임계값 | 경고 |
|------|--------|------|
| 응답 시간 | <15초 | >20초 |
| 토큰 사용량 | <4000 | >6000 |
| API 비용 | <$0.05 | >$0.10 |

---

## LLM-as-Judge 평가 기준

### 평가 루브릭

```markdown
## 평가 기준 (각 1-5점)

1. **정확성** (Accuracy): 요구사항 충족도
   - 5: 모든 요구사항 완벽 충족
   - 3: 주요 기능 구현, 일부 누락
   - 1: 핵심 기능 미구현

2. **가독성** (Readability): 코드 이해 용이성
   - 5: 명확한 변수명, 적절한 주석
   - 3: 이해 가능하나 개선 여지
   - 1: 이해 어려움

3. **보안성** (Security): 취약점 존재 여부
   - 5: 보안 모범 사례 준수
   - 3: 일반적 수준
   - 1: 명백한 취약점 존재

4. **효율성** (Efficiency): 성능 고려
   - 5: 최적화된 코드
   - 3: 적절한 성능
   - 1: 불필요한 연산/렌더링
```

### 합격 기준

| 총점 | 판정 | 액션 |
|------|------|------|
| 16-20 | PASS | 배포 가능 |
| 12-15 | WARN | 리뷰 필요 |
| <12 | FAIL | 재생성 필요 |

---

## 테스트 카테고리

### 1. semo-next (Frontend)

| 카테고리 | 테스트 수 | 설명 |
|----------|----------|------|
| 컴포넌트 생성 | 5 | React 컴포넌트 |
| 훅 구현 | 3 | Custom hooks |
| 폼 처리 | 3 | Form validation |
| API 연동 | 3 | Data fetching |
| 버그 수정 | 5 | Bug fixes |

### 2. semo-backend (Backend) - 예정

| 카테고리 | 테스트 수 | 설명 |
|----------|----------|------|
| API 엔드포인트 | 5 | REST API |
| 서비스 로직 | 5 | Business logic |
| DB 쿼리 | 3 | Repository pattern |

---

## 결과 저장

### 파일 구조

```
evaluation/
├── results/
│   ├── {date}-{time}.json      # 실행 결과
│   └── summary.md               # 주간 요약
├── prompts/
│   ├── code-generation.txt
│   ├── bug-fix.txt
│   └── component-creation.txt
├── promptfoo.yaml              # 설정 파일
└── metrics.md                  # 메트릭 정의 (현재 파일)
```

### 결과 형식

```json
{
  "timestamp": "2025-12-11T10:00:00Z",
  "config": "semo-next-pilot",
  "summary": {
    "total": 10,
    "pass": 8,
    "fail": 2,
    "pass_rate": 0.80
  },
  "metrics": {
    "pass_at_1": 0.70,
    "pass_at_3": 0.90,
    "avg_latency_ms": 12500,
    "avg_cost_usd": 0.03
  }
}
```

---

## CI/CD 통합 (선택적)

### GitHub Actions

```yaml
# .github/workflows/agentic-eval.yml
name: Agentic Evaluation
on:
  pull_request:
    paths:
      - 'semo-core/skills/**'
      - 'semo-next/**'
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 09:00

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run Promptfoo
        run: npx promptfoo eval --config semo-core/evaluation/promptfoo.yaml
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## References

- [Promptfoo Documentation](https://promptfoo.dev/)
- [SEMO → SEMO 전환 계획](../../.claude/plans/prancy-scribbling-falcon.md)
- [SEMO Core Principles](../PRINCIPLES.md)
