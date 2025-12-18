# SEMO Operations Layer (ops)

> 운영 영역: 품질 검증, 모니터링, 개선

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

## ops 고유: 테스트 리포트 품질 게이트 (필수)

QA/테스트 결과 리포트 시 반드시 포함:

| 항목 | 필수 여부 | 설명 |
|------|----------|------|
| **테스트 환경** | 필수 | dev/stg/prd 명시 |
| **테스트 범위** | 필수 | 검증한 AC 항목 나열 |
| **발견 이슈** | 필수 | 버그/개선사항 분류 |
| **스크린샷/영상** | 권장 | 재현 증거 첨부 |

## ops 고유: 버그 리포트 필수 항목

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

## ops 고유: GitHub Task Status 연동

| 액션 | Status 변경 |
|------|-------------|
| 테스트 시작 | → **테스트중** |
| 테스트 통과 | → **병합됨** (개발팀에 알림) |
| 버그 발견 | → **수정요청** (담당자에게 알림) |

---

## 패키지 구조

| 패키지 | 역할 | 대상 |
|--------|------|------|
| `qa` | 테스트, 품질 검증, AC 검증 | QA 담당자 |
| `monitor` | 서비스 현황, 이슈 트래킹 | 운영팀, 개발팀 |
| `improve` | 개선안 도출, 기술 부채 관리 | 개발팀, PO |

## Keywords

| 패키지 | 트리거 키워드 |
|--------|--------------|
| `qa` | 테스트, QA, 검증, AC, 버그, STG, 품질 |
| `monitor` | 현황, 상태, 이슈, 장애, 모니터링, 알림 |
| `improve` | 개선, 리팩토링, 기술부채, 최적화, 성능 |

## References

- [qa/CLAUDE.md](qa/CLAUDE.md)
- [monitor/CLAUDE.md](monitor/CLAUDE.md)
- [improve/CLAUDE.md](improve/CLAUDE.md)
