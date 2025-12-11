# SEMO Test Engine

> Claude Code CLI 기반 Agent/Skill 자동화 테스트 엔진

**위치**: `semo-core/tests/` (Layer 0 - Foundation)

---

## 개요

Claude Code의 비대화형 모드(`-p`)를 활용하여 SEMO Agent/Skill의 동작을 자동으로 테스트합니다.

### 역할 구분

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| **Test Engine** | `semo-core/tests/` | 테스트 실행기, 검증 헬퍼 |
| **Tester Skills** | `semo-skills/tester/` | 테스트 작성, 리포트 생성 스킬 |

> **Gemini 제안**: "테스트 프레임워크"는 Engine(실행기)와 Skill(AI 기능)로 분리

---

## 빠른 시작

```bash
# 의존성 확인
brew install jq  # macOS

# 모든 테스트 실행
./run-tests.sh

# 드라이런 (실제 호출 없이 테스트 케이스 확인)
./run-tests.sh --dry-run

# 특정 테스트만 실행
./run-tests.sh orchestrator
```

---

## 디렉토리 구조

```
semo-core/tests/
├── run-tests.sh          # 테스트 실행기
├── lib/
│   └── assertions.sh     # 검증 헬퍼
├── cases/
│   ├── orchestrator.json # Orchestrator 라우팅 테스트
│   └── message-format.json
└── results/              # 결과 저장
```

---

## 테스트 케이스 형식

```json
{
  "description": "테스트 설명",
  "tests": [
    {
      "name": "테스트 이름",
      "input": "Claude Code에 전달할 입력",
      "expect": {
        "contains": ["필수 키워드"],
        "contains_any": ["옵션1", "옵션2"],
        "not_contains": ["에러"],
        "pattern": "\\[S[AE]MO\\]"
      }
    }
  ]
}
```

---

## 이관 이력

- **이전 위치**: `infra/tests/`
- **새 위치**: `semo-core/tests/`
- **이관 사유**: Gemini 제안 - Test Engine은 Layer 0 Foundation에 속함
