# Routing Table

> Orchestrator의 전체 라우팅 규칙

## Agent 라우팅

| Intent | Agent | Trigger Keywords |
|--------|-------|------------------|
| 테스트 실행 | `qa-master` | "테스트해줘", "검증해줘", "{repo}#{number} 확인" |
| STG 환경 조작 | `stg-operator` | "STG 재시작", "환경 설정", "배포 확인" |

## Skill 라우팅

### 핵심 QA Skills

| Intent | Skill | Trigger |
|--------|-------|---------|
| 테스트중 변경 | `change-to-testing` | "테스트중으로 변경", "QA에 넘겨", "테스트 요청" |
| 테스트 대기열 | `test-queue` | "/SEMO:test-queue", "테스트 대기", "뭐 테스트해" |
| AC 검증 | `validate-test-cases` | "테스트 케이스 확인", "AC 검증" |
| 환경 확인 | `verify-stg-environment` | "STG 상태", "환경 확인", "접속 확인" |
| 테스트 실행 | `execute-test` | qa-master 내부 호출 |
| 결과 보고 | `report-test-result` | "/SEMO:test-pass", "/SEMO:test-fail" |
| AC 요청 | `request-test-cases` | "테스트 케이스 없어", "AC 부족" |
| 이터레이션 | `iteration-tracker` | "몇 번째", "이터레이션", "재테스트 횟수" |
| 배포 게이트 | `production-gate` | "프로덕션 가능", "배포해도 돼" |

### 공통 Skills (SEMO-Core)

| Intent | Skill | Trigger |
|--------|-------|---------|
| 도움말 | `semo-help` | "/SEMO:help", "도움말", "뭐 할 수 있어" |
| 피드백 | `feedback` | "/SEMO:feedback", "버그 신고", "개선 요청" |
| 환경 검증 | `health-check` | "환경 확인", "도구 확인" |

## 명령어 매핑

| Command | Route | Description |
|---------|-------|-------------|
| `/SEMO:help` | `skill:semo-help` | SEMO-QA 도움말 |
| `/SEMO:test-queue` | `skill:test-queue` | 테스트 대기 이슈 목록 |
| `/SEMO:run-test` | `qa-master` | 테스트 실행 |
| `/SEMO:test-pass` | `skill:report-test-result` | 테스트 통과 처리 |
| `/SEMO:test-fail` | `skill:report-test-result` | 테스트 실패 처리 |
| `/SEMO:feedback` | `skill:feedback` | 피드백/버그 신고 |
| `/SEMO:to-testing` | `skill:change-to-testing` | 테스트중 상태 변경 + QA 할당 |

## 우선순위 규칙

1. **명령어**: 슬래시 명령어가 있으면 해당 스킬로 즉시 라우팅
2. **이슈 참조**: `{repo}#{number}` 형식이 있으면 테스트 관련 처리
3. **키워드 매칭**: 키워드 기반 라우팅
4. **컨텍스트**: 이전 대화 흐름 고려

## 라우팅 예시

### Example 1: 테스트 대기열 확인

```
User: "테스트할 이슈 뭐야?"

[SEMO] Orchestrator: 의도 분석 완료 → 테스트 대기열 조회

[SEMO] Skill 호출: test-queue
```

### Example 2: 테스트 통과 처리

```
User: "/SEMO:test-pass cm-office#45"

[SEMO] Orchestrator: 의도 분석 완료 → 테스트 결과 보고

[SEMO] Skill 호출: report-test-result (cm-office#45, result: pass)
```

### Example 3: 테스트 실패 처리

```
User: "cm-office#45 실패야. 버튼 클릭이 안돼"

[SEMO] Orchestrator: 의도 분석 완료 → 테스트 결과 보고

[SEMO] Skill 호출: report-test-result (cm-office#45, result: fail, reason: 버튼 클릭 불가)
```

### Example 4: 테스트중 상태 변경 + QA 자동 할당

```
User: "cm-office#50 테스트중으로 변경해줘"

[SEMO] Orchestrator: 의도 분석 완료 → 테스트중 상태 변경

[SEMO] Skill 호출: change-to-testing (cm-office#50)
```

```
User: "/SEMO:to-testing core-backend#22"

[SEMO] Orchestrator: 의도 분석 완료 → 테스트중 상태 변경

[SEMO] Skill 호출: change-to-testing (core-backend#22)
→ 상태 변경: 테스트중
→ QA 할당: @kokkh (자동)
```
