# SEMO Business - Management Package

> 일정/인력/스프린트 관리

## Package Info

- **Package**: biz/management
- **Version**: [../VERSION](../VERSION) 참조
- **Target**: docs repository (Epic/Sprint 중심)
- **Audience**: PM, 프로젝트 관리자, 팀 리드

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| 스프린트 관리 | Sprint 계획, 실행, 종료 |
| 일정 관리 | 로드맵, 마일스톤, 타임라인 |
| 인력 관리 | 담당자 할당, 용량 확인 |
| 진행도 추적 | 진행 현황, 완료율 모니터링 |
| 리포팅 | 주간/인원별 리포트 생성 |

---

## Routing Keywords

| 키워드 | 위임 대상 |
|--------|----------|
| Sprint, 스프린트 | sprint-master |
| 할당, 배정, assign | sprint-master |
| 진행도, 현황, 완료율 | progress-tracker |
| 리포트, 보고서 | progress-tracker |
| 로드맵, 마일스톤 | roadmap-planner |
| 블로커, 지연, 리스크 | progress-tracker |

---

## Sprint 주기 (2주)

| 단계 | 시점 | 활동 |
|------|------|------|
| 계획 | Week 1 시작 | Sprint 목표 수립, Task 선정 |
| 할당 | Week 1 시작 | 담당자 배정, 용량 확인 |
| 추적 | Week 1-2 | Daily 진행도 모니터링 |
| 마감 | Week 2 종료 | Sprint 종료, 회고, Velocity 계산 |

---

## Agents

| Agent | 역할 | 원본 |
|-------|------|------|
| orchestrator | management 작업 라우팅 | pm/orchestrator |
| sprint-master | Sprint 계획/관리 | pm/sprint-master |
| progress-tracker | 진행도 추적/리포팅 | pm/progress-tracker |
| roadmap-planner | 장기 일정/Roadmap | pm/roadmap-planner |

---

## Skills

| Skill | 역할 | 원본 |
|-------|------|------|
| create-sprint | Sprint 생성 | pm/create-sprint |
| close-sprint | Sprint 종료 + Velocity 계산 | pm/close-sprint |
| assign-task | Task 할당 통합 워크플로우 | pm/assign-task |
| assign-to-sprint | Sprint에 Task 할당 | pm/assign-to-sprint |
| generate-progress-report | 진행도 리포트 | pm/generate-progress-report |
| generate-member-report | 인원별 리포트 | pm/generate-member-report |
| detect-blockers | 블로커 감지 | pm/detect-blockers |
| calculate-velocity | Velocity 계산 | pm/calculate-velocity |
| generate-roadmap | Roadmap 생성 | pm/generate-roadmap |
| health-check | 환경 검증 | 공통 |

---

## PO vs PM 역할 분담

```text
biz/discovery (PO/기획)        biz/management (PM/관리)
─────────────────              ─────────────────
Epic 생성          ───→        Sprint Backlog 추가
Draft Task 생성    ───→        Sprint 할당
Ready Task         ───→        Progress 추적
                               리포트 생성 → Slack 알림
```

---

## Commands

| Command | 기능 |
|---------|------|
| `/SEMO:sprint` | Sprint 생성, 할당, 종료 |
| `/SEMO:progress` | 진행도 조회 |
| `/SEMO:report` | 주간/인원별 리포트 생성 |
| `/SEMO:roadmap` | Roadmap 생성 |

---

## References

- [biz 레이어](../CLAUDE.md)
- [discovery 패키지](../discovery/CLAUDE.md)
- [design 패키지](../design/CLAUDE.md)
