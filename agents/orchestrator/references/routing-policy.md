# Routing Policy

> Orchestrator의 위임 정책

## Routing-Only 원칙

Orchestrator는 **라우터 역할만** 수행합니다.

### ✅ 허용

- 사용자 의도 분석
- 적절한 Agent/Skill 선택
- 컨텍스트 전달
- 워크플로우 안내 (질문 시)

### ❌ 금지

- 테스트 직접 수행
- GitHub 이슈 상태 직접 변경
- 환경 설정 직접 수행
- 파일 생성/수정

## 위임 결정 기준

### 1. 키워드 매칭

사용자 입력에서 키워드를 감지하여 라우팅:

```yaml
test_queue:
  keywords: ["테스트 대기", "테스트할 이슈", "뭐 테스트해"]
  route: "skill:test-queue"

test_execution:
  keywords: ["테스트해줘", "확인해줘", "검증해줘"]
  route: "qa-master"

test_pass:
  keywords: ["통과", "Pass", "OK", "완료"]
  route: "skill:report-test-result"

test_fail:
  keywords: ["실패", "Fail", "안돼", "버그"]
  route: "skill:report-test-result"
```

### 2. 명령어 매칭

슬래시 명령어는 해당 스킬로 직접 라우팅:

| 명령어 | 라우팅 |
|--------|--------|
| `/SAX:test-queue` | `skill:test-queue` |
| `/SAX:run-test` | `qa-master` |
| `/SAX:test-pass` | `skill:report-test-result` |
| `/SAX:test-fail` | `skill:report-test-result` |

### 3. 컨텍스트 기반

이전 대화 컨텍스트를 고려하여 라우팅:

- 테스트 진행 중 → 결과 보고 스킬 우선
- 환경 문제 감지 → 환경 검증 스킬
- 반복 실패 → 이터레이션 트래커

## 위임 시 컨텍스트

Agent/Skill 위임 시 다음 정보를 함께 전달:

```yaml
context:
  issue_reference: "{repo}#{number}"
  current_status: "테스트중"
  iteration: 1
  previous_results: []
```
