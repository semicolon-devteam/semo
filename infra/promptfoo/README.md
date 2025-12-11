# SEMO Promptfoo 품질 평가

> Agent/Skill 품질 테스트 및 Pass@k 메트릭 수집

## 개요

Promptfoo를 사용하여 SEMO Agent/Skill의 품질을 자동으로 평가합니다.

### 평가 지표

| 지표 | 설명 |
|------|------|
| **Pass@1** | 첫 시도에서 올바른 응답 생성 확률 |
| **Pass@5** | 5번 시도 중 최소 1번 올바른 응답 생성 확률 |
| **일관성** | 동일 입력에 대한 응답 일관성 |

## 빠른 시작

```bash
# 1. Promptfoo 설치
npm install -g promptfoo

# 2. 환경변수 설정
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# 3. 평가 실행
./run-eval.sh
```

## 실행 옵션

```bash
./run-eval.sh              # 전체 평가 (Sonnet + Haiku + Opus)
./run-eval.sh --quick      # 빠른 평가 (Haiku만, 3회)
./run-eval.sh --view       # 결과 웹 UI로 보기
./run-eval.sh --ci         # CI 모드 (실패 시 exit 1)
```

## 테스트 케이스

### Orchestrator Agent

| 테스트 | 검증 내용 |
|--------|----------|
| 라우팅 정확도 | 접두사 기반 패키지 라우팅 |
| 복합 패키지 | 다중 패키지 작업 분할 |
| 엣지 케이스 | 잘못된 접두사, 접두사 없음 |

### Slack Skill

| 테스트 | 검증 내용 |
|--------|----------|
| 메시지 포맷팅 | 채널명, 메시지 형식 |
| 오류 처리 | 잘못된 채널, 권한 부족 |

## 결과 분석

```bash
# 결과 파일 위치
results/
├── latest.json           # 최신 결과
├── quick-YYYYMMDD.json   # 빠른 평가 결과
└── ci-YYYYMMDD.json      # CI 실행 결과
```

### Pass@k 해석

| Pass@k | 상태 | 조치 |
|--------|------|------|
| ≥ 95% | ✅ 우수 | 유지 |
| 80-95% | ⚠️ 주의 | 프롬프트 개선 검토 |
| < 80% | ❌ 문제 | 즉시 개선 필요 |

## CI/CD 연동

```yaml
# .github/workflows/quality.yml
jobs:
  prompt-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g promptfoo
      - run: cd infra/promptfoo && ./run-eval.sh --ci
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## 새 테스트 추가

`promptfooconfig.yaml`에 테스트 케이스 추가:

```yaml
tests:
  - description: "새 테스트 설명"
    vars:
      input: "테스트 입력"
    assert:
      - type: contains
        value: "예상 포함 문자열"
      - type: llm-rubric
        value: "LLM이 평가할 기준"
```
