# SAX/SEMO Agentic Evaluation

> Promptfoo 기반 Agent/Skill 품질 자동 평가 시스템

---

## Quick Start

### 1. 설치

```bash
# Promptfoo 설치
npm install -g promptfoo

# 또는 npx로 직접 실행
npx promptfoo --version
```

### 2. 환경 변수 설정

```bash
# ANTHROPIC_API_KEY 설정 (필수)
export ANTHROPIC_API_KEY="your-api-key"
```

### 3. 평가 실행

```bash
cd sax-core

# 기본 실행
npx promptfoo eval --config evaluation/promptfoo.yaml

# 결과를 JSON으로 저장
npx promptfoo eval --config evaluation/promptfoo.yaml --output evaluation/results/$(date +%Y%m%d).json

# 웹 UI로 결과 확인
npx promptfoo view
```

---

## 파일 구조

```
evaluation/
├── README.md           # 사용 가이드 (현재 파일)
├── promptfoo.yaml      # Promptfoo 설정
├── metrics.md          # 메트릭 정의
├── prompts/            # 프롬프트 템플릿
│   ├── code-generation.txt
│   ├── bug-fix.txt
│   └── component-creation.txt
└── results/            # 평가 결과 저장
    └── .gitkeep
```

---

## 테스트 케이스

### 현재 포함된 테스트 (sax-next 파일럿)

| # | 테스트 | 검증 항목 |
|---|--------|----------|
| 1 | React loading 상태 | useState, TypeScript |
| 2 | API 에러 핸들링 | try-catch, UI 처리 |
| 3 | 폼 유효성 검사 | email/password validation |
| 4 | useEffect 버그 수정 | 의존성 배열 |
| 5 | TypeScript 인터페이스 | 타입 정의, union type |

### 테스트 추가 방법

`promptfoo.yaml`의 `tests` 섹션에 추가:

```yaml
tests:
  - description: "새 테스트 설명"
    vars:
      task: "수행할 작업"
      context: "추가 컨텍스트"
    assert:
      - type: contains
        value: "필수 포함 문자열"
      - type: llm-rubric
        value: "LLM이 평가할 기준"
```

---

## 평가 기준

### 자동 검증 (Assert)

| 타입 | 설명 | 예시 |
|------|------|------|
| `contains` | 문자열 포함 | `useState` |
| `not-contains` | 문자열 미포함 | `[data]` |
| `javascript` | JS 표현식 | `output.includes('x')` |
| `latency` | 응답 시간 | `< 15000ms` |
| `cost` | API 비용 | `< $0.05` |
| `llm-rubric` | LLM 판단 | "타입 안전성 준수?" |

### LLM-as-Judge

복잡한 품질 기준은 LLM이 판단:

```yaml
- type: llm-rubric
  value: "코드가 React best practices를 따르는가?"
```

---

## 결과 해석

### Pass 기준

| 조건 | 결과 |
|------|------|
| 모든 assert 통과 | PASS |
| 하나라도 실패 | FAIL |

### 메트릭

| 메트릭 | 목표 | 설명 |
|--------|------|------|
| Pass@1 | >70% | 첫 시도 성공률 |
| Pass@3 | >90% | 3회 내 성공률 |
| Latency | <15s | 평균 응답 시간 |

---

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: Agentic Evaluation
on:
  pull_request:
    paths:
      - 'sax-core/skills/**'
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx promptfoo eval --config sax-core/evaluation/promptfoo.yaml
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 비용 관리

### 예상 비용

| 테스트 수 | 예상 비용 | 비고 |
|----------|----------|------|
| 5개 | ~$0.15 | 기본 실행 |
| 5개 x 5회 | ~$0.75 | Pass@5 측정 |

### 비용 절감 팁

1. **로컬 테스트 우선**: CI/CD 전 로컬에서 검증
2. **필터 사용**: 특정 테스트만 실행
   ```bash
   npx promptfoo eval --filter "loading"
   ```
3. **캐싱 활용**: 동일 입력은 캐시 사용

---

## Troubleshooting

### API Key 오류

```
Error: ANTHROPIC_API_KEY not set
```

**해결**: 환경 변수 설정 확인

### Timeout 오류

```
Error: Request timed out
```

**해결**: `promptfoo.yaml`에서 timeout 증가

```yaml
providers:
  - id: anthropic:claude-sonnet-4-20250514
    config:
      timeout: 60000  # 60초
```

---

## References

- [Promptfoo Documentation](https://promptfoo.dev/)
- [SAX Metrics 정의](./metrics.md)
- [SAX → SEMO 전환 계획](../../.claude/plans/prancy-scribbling-falcon.md)
