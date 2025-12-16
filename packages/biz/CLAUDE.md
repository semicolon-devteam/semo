# SEMO Business Layer (biz)

> 사업 영역: 아이템 발굴, 기획, 설계, 프로젝트 관리, PoC 검증

## 🔴 Business Layer 공통 규칙

> **biz 패키지 하위 모든 환경에서 적용되는 필수 규칙**

### Epic/Task 품질 게이트 (필수)

Epic 또는 Task 생성 시 반드시 다음을 포함해야 합니다:

| 항목 | 필수 여부 | 설명 |
|------|----------|------|
| **AC (Acceptance Criteria)** | 필수 | 완료 조건 명확히 정의 |
| **작업량 추정** | 필수 | Estimation Point (1,2,3,5,8,13) |
| **우선순위** | 필수 | P0~P4 |
| **Projects 연동** | 필수 | 이슈관리(#1) 프로젝트에 추가 |

**차단 항목**:
- AC 없는 Epic 생성 거부
- 작업량 미추정 Task 생성 거부
- "일단 만들어줘", "나중에 추가할게" 등 거부

### 개발자 관점 체크리스트

Epic/Task 작성 전 반드시 검토:

| 카테고리 | 핵심 질문 |
|----------|----------|
| **데이터 흐름** | 동시 수정 충돌? 멀티플랫폼 동기화? |
| **시간/계산** | 집계 기준? 일할 계산 방식? |
| **플랫폼 제약** | PWA/웹/네이티브 제약? |
| **예외 케이스** | 0건, 대량 데이터, 권한 없음? |

### GitHub Task Status 연동

| 단계 | Status | 조건 |
|------|--------|------|
| Epic 생성 | → **검수대기** | 자동 설정 |
| 검수 통과 | → **검수완료** | PM 승인 시 |
| 스프린트 할당 | → **작업중** | 개발 시작 시 |

---

## 📦 세미콜론 프로젝트 컨텍스트

### 프로젝트 유형

| 유형 | 설명 | 조회 링크 |
|------|------|----------|
| **정식 프로젝트 (cm-*)** | 프로덕션 서비스, Full Pipeline | [GitHub 조회](https://github.com/semicolon-devteam?q=cm&type=all) |
| **MVP 프로젝트 (mvp-*)** | 빠른 검증용, Fast Track | [GitHub 조회](https://github.com/semicolon-devteam?q=mvp&type=all) |

### 정식 vs MVP 결정 기준

| 기준 | 정식 프로젝트 | MVP |
|------|-------------|-----|
| 검증 목표 | 장기 운영 | 빠른 가설 검증 |
| 품질 수준 | 높음 (DDD 4계층) | 최소 (2계층) |
| 배포 환경 | dev/stg/prd 3단계 | Vercel 단일 |
| 코드 리뷰 | 필수 | 선택 |

### 역할 체계 (SEMO 기준)

| SEMO 그룹 | 담당 영역 | 레거시 역할 |
|----------|----------|------------|
| **biz** | 기획, Epic/Task, 프로젝트 관리 | PO, PM, PSM |
| **eng** | 개발, 인프라, 배포 | Dev, DevOps |
| **ops** | QA, 운영, 모니터링 | QA, 운영팀 |

---

## Overview

Business Layer는 제품/서비스의 **기획 및 검증** 단계를 담당합니다.

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `discovery` | 아이템 발굴, 시장 조사, Epic/Task 생성 | PO, 기획자 |
| `design` | 컨셉 설계, 목업, UX 핸드오프 | 디자이너, PO |
| `management` | 일정/인력/스프린트 관리 | PM |
| `poc` | 빠른 PoC, 패스트트랙 개발 | 기획자, 개발자 |

## Routing

```
사용자 요청 분석
    ↓
┌─────────────────────────────────────────────────────┐
│ biz/discovery: 아이템, 시장조사, Epic, Task, 요구사항 │
│ biz/design: 목업, 컨셉, UX, 핸드오프, Figma         │
│ biz/management: 스프린트, 일정, 인력, 진행도        │
│ biz/poc: PoC, 빠른검증, 프로토타입, MVP             │
└─────────────────────────────────────────────────────┘
```

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `discovery` | Epic, Task, 요구사항, 아이템, 시장조사, AC, 스펙 |
| `design` | 목업, 컨셉, UX, UI, 핸드오프, Figma, 디자인 |
| `management` | 스프린트, 일정, 인력, 담당자, 진행도, 로드맵 |
| `poc` | PoC, 빠른검증, 프로토타입, 패스트트랙, MVP |

## Layer Workflow

```
discovery (발견)
    ↓ Epic/Task 정의
design (설계)
    ↓ 목업/스펙 완성
management (관리)
    ↓ 스프린트 할당
poc (검증)
    ↓ 빠른 구현 및 검증
eng/ (개발로 이관)
```

## References

- [discovery/CLAUDE.md](discovery/CLAUDE.md)
- [design/CLAUDE.md](design/CLAUDE.md)
- [management/CLAUDE.md](management/CLAUDE.md)
- [poc/CLAUDE.md](poc/CLAUDE.md)
