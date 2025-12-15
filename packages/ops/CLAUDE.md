# SEMO Operations Layer (ops)

> 운영 영역: 품질 검증, 모니터링, 개선

## Overview

Operations Layer는 **서비스 운영 및 품질 관리**를 담당합니다.

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `qa` | 테스트, 품질 검증, AC 검증 | QA 담당자 |
| `monitor` | 서비스 현황, 이슈 트래킹 | 운영팀, 개발팀 |
| `improve` | 개선안 도출, 기술 부채 관리 | 개발팀, PO |

## Routing

```
사용자 요청 분석
    ↓
┌─────────────────────────────────────────────────────┐
│ ops/qa: 테스트, QA, 검증, AC, 버그리포트            │
│ ops/monitor: 현황, 상태, 이슈, 장애, 모니터링       │
│ ops/improve: 개선, 리팩토링, 기술부채, 최적화       │
└─────────────────────────────────────────────────────┘
```

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `qa` | 테스트, QA, 검증, AC, 버그, STG, 품질 |
| `monitor` | 현황, 상태, 이슈, 장애, 모니터링, 알림 |
| `improve` | 개선, 리팩토링, 기술부채, 최적화, 성능 |

## Workflow

```
eng/ (개발 완료)
    ↓
ops/qa (품질 검증)
    ↓ 배포
ops/monitor (운영 모니터링)
    ↓ 이슈 발견
ops/improve (개선안 도출)
    ↓
biz/discovery (새로운 요구사항)
```

## References

- [qa/CLAUDE.md](qa/CLAUDE.md)
- [monitor/CLAUDE.md](monitor/CLAUDE.md)
- [improve/CLAUDE.md](improve/CLAUDE.md)
