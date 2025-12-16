# SEMO Operations Layer (ops)

> 운영 영역: 품질 검증, 모니터링, 개선

## 🔴 Operations Layer 공통 규칙

> **ops 패키지 하위 모든 환경에서 적용되는 필수 규칙**

### 테스트 리포트 품질 게이트 (필수)

QA/테스트 결과 리포트 시 반드시 포함:

| 항목 | 필수 여부 | 설명 |
|------|----------|------|
| **테스트 환경** | 필수 | dev/stg/prd 명시 |
| **테스트 범위** | 필수 | 검증한 AC 항목 나열 |
| **발견 이슈** | 필수 | 버그/개선사항 분류 |
| **스크린샷/영상** | 권장 | 재현 증거 첨부 |

### 버그 리포트 필수 항목

버그 등록 시 반드시 포함:

| 항목 | 설명 |
|------|------|
| **재현 단계** | 1, 2, 3... 순서대로 |
| **기대 동작** | 원래 어떻게 되어야 하는지 |
| **실제 동작** | 실제로 어떻게 되는지 |
| **환경 정보** | 브라우저, OS, 테스트 환경 |
| **심각도** | Critical/Major/Minor/Trivial |

**차단 항목**:
- 재현 단계 없는 버그 등록 거부
- 환경 정보 없는 버그 등록 거부

### GitHub Task Status 연동

| 액션 | Status 변경 |
|------|-------------|
| 테스트 시작 | → **테스트중** |
| 테스트 통과 | → **병합됨** (개발팀에 알림) |
| 버그 발견 | → **수정요청** (담당자에게 알림) |

---

## 📦 세미콜론 운영 컨텍스트

### 테스트 환경

| 환경 | URL 패턴 | 용도 |
|------|----------|------|
| **DEV** | `https://dev.{service}.com` | 개발 확인 |
| **STG** | `https://stg.{service}.com` | QA 테스트 (기본) |
| **PRD** | `https://{service}.com` | 운영 |

> 서비스 목록: [GitHub cm-* 검색](https://github.com/semicolon-devteam?q=cm&type=all)

### QA 프로세스

```
PR 병합 → STG 자동 배포 → QA 테스트 시작
  ↓
AC 기반 검증
  ├─ PASS → Status: 병합됨 → PRD 배포 가능
  └─ FAIL → 버그 이슈 생성 → Status: 수정요청
```

### 테스트 요청 시 포함 정보

```
@{tester} [{issue_title}] 테스트 요청드립니다

📍 테스트 환경: STG
🔗 URL: https://stg.{service}.com
📋 이슈: {issue_url}
```

### API 스펙 확인

- **최신 API 문서**: https://core-interface-ashen.vercel.app/
- **릴리즈 노트**: https://github.com/semicolon-devteam/core-interface/releases

---

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
