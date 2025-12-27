# ops/qa Quickstart

> QA 담당자를 위한 빠른 시작 가이드

## 대상

- QA 담당자
- 테스터
- 품질 관리 담당자

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `execute-test` | 테스트 실행 | "테스트 실행해줘" |
| `report-bug` | 버그 리포트 | "버그 리포트 만들어줘" |
| `validate-test-cases` | TC 검증 | "테스트케이스 검증해줘" |
| `production-gate` | 프로덕션 게이트 | "배포 승인 확인해줘" |

## 빠른 시작 예시

```text
"테스트 실행해줘"             → skill:execute-test
"버그 리포트 만들어줘"        → skill:report-bug
"테스트케이스 검증해줘"       → skill:validate-test-cases
"배포 승인 확인해줘"          → skill:production-gate
```

## QA 워크플로우

```text
1. 테스트 요청 수신
   → 프로젝트 보드에서 "테스트중" 상태 확인
   → AC 기반 테스트케이스 확인

2. STG 환경 테스트
   → "테스트 실행해줘"
   → AC 항목별 Pass/Fail 기록

3. 결과 리포트
   ├─ Pass → "배포 승인해줘"
   └─ Fail → "버그 리포트 만들어줘"

4. 프로덕션 게이트
   → 모든 TC Pass 시 배포 승인
```

## 테스트 결과 상태

| 상태 | 설명 | 다음 단계 |
| ---- | ---- | --------- |
| Pass | 모든 TC 통과 | 병합됨 |
| Fail | 일부 TC 실패 | 버그 리포트 |
| Block | 테스트 불가 | 개발팀 확인 |

## 상세 튜토리얼

```text
"QA 온보딩 실습해줘" → skill:onboarding-qa
```
