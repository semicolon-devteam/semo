# SEMO Test Framework

> Claude Code CLI 기반 Agent/Skill 자동화 테스트

---

## 개요

Claude Code의 비대화형 모드(`-p`)를 활용하여 SEMO Agent/Skill의 동작을 자동으로 테스트합니다.

### 특징

- **JSON 기반 테스트 케이스**: 코드 작성 없이 테스트 정의
- **유연한 검증**: contains, contains_any, not_contains, pattern (정규식)
- **비용 추적**: 테스트 실행 비용 자동 계산
- **결과 저장**: JSON 형식 결과 저장 및 히스토리
- **최소 의존성**: jq만 필요 (macOS/Linux 기본 도구)

---

## 빠른 시작

```bash
# 의존성 확인
brew install jq  # macOS
# apt install jq  # Linux

# 모든 테스트 실행
./run-tests.sh

# 특정 테스트만 실행
./run-tests.sh orchestrator

# 드라이런 (실제 호출 없이 테스트 케이스 확인)
./run-tests.sh --dry-run
```

---

## 테스트 케이스 작성

### 파일 위치

```
infra/tests/
├── run-tests.sh          # 테스트 실행기
├── cases/
│   ├── orchestrator.json # Orchestrator 테스트
│   ├── message-format.json
│   └── ...
├── lib/
│   └── assertions.sh     # 검증 헬퍼
└── results/              # 결과 저장
```

### JSON 형식

```json
{
  "description": "테스트 설명",
  "tests": [
    {
      "name": "테스트 이름",
      "input": "Claude Code에 전달할 입력",
      "expect": {
        "contains": ["필수 키워드1", "필수 키워드2"],
        "contains_any": ["옵션1", "옵션2"],
        "not_contains": ["에러", "Error"],
        "pattern": "\\[S[AE]MO\\]"
      }
    }
  ]
}
```

---

## 검증 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `contains` | 모든 문자열이 포함되어야 함 | `["API", "성공"]` |
| `contains_any` | 하나라도 포함되면 통과 | `["semo-next", "semo-next"]` |
| `not_contains` | 포함되면 실패 | `["에러", "Error"]` |
| `pattern` | 정규식 매칭 | `"\\[SAX\\].*Orchestrator"` |

---

## 비결정론적 응답 처리

LLM 응답은 매번 다를 수 있으므로:

1. **키워드 기반 검증**: 정확한 문자열이 아닌 핵심 키워드
2. **다중 옵션 (OR)**: 여러 표현 중 하나 허용
3. **유연한 정규식**: 변동 가능한 부분을 패턴으로

```json
// 좋은 예: 유연한 검증
{
  "expect": {
    "contains_any": ["semo-next", "semo-next", "next 패키지"]
  }
}

// 나쁜 예: 너무 엄격
{
  "expect": {
    "contains": ["[SEMO] Orchestrator: 의도 분석 완료 → 코드 수정"]
  }
}
```

---

## 결과 형식

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "passed": 4,
  "failed": 1,
  "skipped": 0,
  "total_cost_usd": 0.0123
}
```

---

## 의존성

| 도구 | 용도 | 설치 |
|------|------|------|
| `jq` | JSON 파싱 | `brew install jq` |
| `claude` | Claude Code CLI | `npm i -g @anthropic-ai/claude-code` |

---

## 확장 계획

### Phase 2: 고급 기능

- [ ] LLM-as-Judge (의미 기반 검증)
- [ ] 반복 실행 + 통계 (5회 중 4회 통과 시 성공)
- [ ] HTML 리포트 생성

### Phase 3: CI 통합

```yaml
# .github/workflows/semo-test.yml
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: ./infra/tests/run-tests.sh
```
