# SAX-PM Package Configuration

> PM/프로젝트 매니저를 위한 SAX 패키지

## Package Info

- **Package**: SAX-PM
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository (Epic/Sprint 중심)
- **Audience**: PM, 프로젝트 관리자, 팀 리드

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [sax-core/_shared/INIT_SETUP.md](sax-core/_shared/INIT_SETUP.md)

### 2. SAX Core 참조

> 📖 상세: [sax-core/_shared/SAX_CORE_REFERENCE.md](sax-core/_shared/SAX_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [sax-core/_shared/ORCHESTRATOR_RULES.md](sax-core/_shared/ORCHESTRATOR_RULES.md)

| 키워드 | 위임 대상 |
|--------|----------|
| Sprint, 스프린트 | sprint-master |
| 할당, 배정, assign | sprint-master |
| 진행도, 현황, 완료율 | progress-tracker |
| 리포트, 보고서 | progress-tracker |
| 로드맵, 마일스톤 | roadmap-planner |
| 블로커, 지연, 리스크 | progress-tracker |

---

## PM 워크플로우

### SAX-PO vs SAX-PM

```text
SAX-PO (기획)              SAX-PM (관리)
─────────────              ─────────────
Epic 생성          ───→    Sprint Backlog 추가
Draft Task 생성    ───→    Sprint 할당
Ready Task         ───→    Progress 추적
                           리포트 생성 → Slack 알림
```

### Sprint 주기 (2주)

| 단계 | 시점 | 활동 |
|------|------|------|
| 계획 | Week 1 시작 | Sprint 목표 수립, Task 선정 |
| 할당 | Week 1 시작 | 담당자 배정, 용량 확인 |
| 추적 | Week 1-2 | Daily 진행도 모니터링 |
| 마감 | Week 2 종료 | Sprint 종료, 회고, Velocity 계산 |

---

## Agents & Skills 요약

### Agents

| Agent | 역할 |
|-------|------|
| sprint-master | Sprint 계획/관리 |
| progress-tracker | 진행도 추적/리포팅 |
| roadmap-planner | 장기 일정/Roadmap |

### Skills

| Skill | 역할 |
|-------|------|
| assign-task | Task 할당 통합 워크플로우 |
| create-sprint | Sprint 생성 |
| close-sprint | Sprint 종료 + Velocity 계산 |
| generate-progress-report | 진행도 리포트 |
| generate-member-report | 인원별 리포트 |
| detect-blockers | 블로커 감지 |

---

## Commands

| Command | 기능 |
|---------|------|
| `/SAX:sprint` | Sprint 생성, 할당, 종료 |
| `/SAX:progress` | 진행도 조회 |
| `/SAX:report` | 주간/인원별 리포트 생성 |
| `/SAX:roadmap` | Roadmap 생성 |

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
