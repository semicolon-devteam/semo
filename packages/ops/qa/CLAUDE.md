# SEMO Operations - QA Package

> 테스트, 품질 검증, AC 검증

## Package Info

- **Package**: ops/qa
- **Version**: [../VERSION](../VERSION) 참조
- **Target**: STG 환경 테스트
- **Audience**: QA 담당자, 테스터

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| AC 검증 | Acceptance Criteria 기반 테스트 |
| STG 테스트 | 스테이징 환경 검증 |
| 버그 리포트 | 버그 발견 시 이슈 생성 |
| 테스트 케이스 | 테스트 케이스 생성/관리 |
| 프로덕션 게이트 | 배포 전 최종 검증 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| 테스트, test | 테스트 실행 |
| QA, qa | QA 프로세스 |
| AC, 수락조건 | AC 기반 검증 |
| 버그, bug | 버그 리포트 |
| STG, staging | 스테이징 환경 |
| 검증, verify | 검증 작업 |

---

## QA 워크플로우

```text
eng/platforms/* (개발 완료)
    ↓
PR 생성 → STG 배포
    ↓
ops/qa (AC 기반 테스트)
    ↓
테스트 통과 → Production Gate
    ↓
프로덕션 배포
```

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | QA 작업 라우팅 |
| qa-master | QA 프로세스 총괄 |
| stg-operator | STG 환경 운영 |

---

## Skills

| Skill | 역할 |
|-------|------|
| execute-test | 테스트 실행 |
| validate-test-cases | 테스트 케이스 검증 |
| request-test-cases | 테스트 케이스 요청 |
| report-test-result | 테스트 결과 리포트 |
| report-bug | 버그 리포트 생성 |
| change-to-testing | 상태 변경 (Testing) |
| production-gate | 프로덕션 게이트 체크 |
| verify-stg-environment | STG 환경 검증 |
| current-tasks | 현재 QA 태스크 조회 |
| test-queue | 테스트 대기열 관리 |
| health-check | 환경 검증 |

---

## AC 기반 테스트 프로세스

### 1. 테스트 준비
```text
Task Card 확인 → AC 항목 추출 → 테스트 케이스 생성
```

### 2. 테스트 실행
```text
STG 환경 접속 → 테스트 케이스 실행 → 결과 기록
```

### 3. 결과 처리
```text
Pass → Production Gate 승인
Fail → 버그 리포트 → 개발팀 전달
```

---

## References

- [ops 레이어](../CLAUDE.md)
- [monitor 패키지](../monitor/CLAUDE.md)
- [improve 패키지](../improve/CLAUDE.md)
