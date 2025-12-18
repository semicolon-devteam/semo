# SEMO Business Layer (biz)

> 사업 영역: 아이템 발굴, 기획, 설계, 프로젝트 관리, PoC 검증

## Core Rules (상속)

> 📄 다음 규칙은 [semo-core/principles/](../../semo-system/semo-core/principles/)에서 참조합니다.

| 규칙 | 참조 |
|------|------|
| Orchestrator-First | [ORCHESTRATOR_FIRST.md](../../semo-system/semo-core/principles/ORCHESTRATOR_FIRST.md) |
| Quality Gate | [QUALITY_GATE.md](../../semo-system/semo-core/principles/QUALITY_GATE.md) |
| Session Init | [SESSION_INIT.md](../../semo-system/semo-core/principles/SESSION_INIT.md) |
| Versioning | [VERSIONING.md](../../semo-system/semo-core/principles/VERSIONING.md) |
| Prefix Routing | [PREFIX_ROUTING.md](../../semo-system/semo-core/principles/PREFIX_ROUTING.md) |

---

## biz 고유: Epic/Task 품질 게이트 (필수)

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

## biz 고유: 개발자 관점 체크리스트

Epic/Task 작성 전 반드시 검토:

| 카테고리 | 핵심 질문 |
|----------|----------|
| **데이터 흐름** | 동시 수정 충돌? 멀티플랫폼 동기화? |
| **시간/계산** | 집계 기준? 일할 계산 방식? |
| **플랫폼 제약** | PWA/웹/네이티브 제약? |
| **예외 케이스** | 0건, 대량 데이터, 권한 없음? |

## biz 고유: GitHub Task Status 연동

| 단계 | Status | 조건 |
|------|--------|------|
| Epic 생성 | → **검수대기** | 자동 설정 |
| 검수 통과 | → **검수완료** | PM 승인 시 |
| 스프린트 할당 | → **작업중** | 개발 시작 시 |

---

## 패키지 구조

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `discovery` | 아이템 발굴, 시장 조사, Epic/Task 생성 | PO, 기획자 |
| `design` | 컨셉 설계, 목업, UX 핸드오프 | 디자이너, PO |
| `management` | 일정/인력/스프린트 관리 | PM |
| `poc` | 빠른 PoC, 패스트트랙 개발 | 기획자, 개발자 |

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `discovery` | Epic, Task, 요구사항, 아이템, 시장조사, AC, 스펙 |
| `design` | 목업, 컨셉, UX, UI, 핸드오프, Figma, 디자인 |
| `management` | 스프린트, 일정, 인력, 담당자, 진행도, 로드맵 |
| `poc` | PoC, 빠른검증, 프로토타입, 패스트트랙, MVP |

## References

- [discovery/CLAUDE.md](discovery/CLAUDE.md)
- [design/CLAUDE.md](design/CLAUDE.md)
- [management/CLAUDE.md](management/CLAUDE.md)
- [poc/CLAUDE.md](poc/CLAUDE.md)
