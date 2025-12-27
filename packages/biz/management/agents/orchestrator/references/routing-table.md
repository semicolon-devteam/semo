# Orchestrator Routing Table

> 키워드 기반 Agent/Skill 라우팅 규칙

## Agent 라우팅

### sprint-master

**트리거 키워드**:
- Sprint, 스프린트, 반복, iteration
- 주간계획, 2주, biweekly
- 할당, 배정, assign, add to sprint
- 종료, close, 완료, 회고, retrospective
- Velocity, 속도, 생산성
- 작업량, estimate, point, 포인트, 추정
- 시작, start, 작업중, in progress, 착수

**위임 사유 템플릿**:
- Sprint 생성 요청
- Task Sprint 할당
- Task 작업량 설정
- Task 작업 시작
- Sprint 종료 처리
- Velocity 계산

---

### progress-tracker

**트리거 키워드**:
- 진행도, 진척, 현황, status, progress
- 리포트, 보고서, report, 주간보고, 일일보고
- 인원별, 담당자별, member, assignee
- 블로커, 지연, blocked, delayed, 병목
- 완료율, 달성률, completion

**위임 사유 템플릿**:
- 진행 상황 조회
- 리포트 생성
- 인원별 현황 조회
- 블로커 감지

---

### roadmap-planner

**트리거 키워드**:
- 로드맵, roadmap, 일정, timeline
- 마일스톤, milestone
- 장기계획, 분기계획, quarterly
- Gantt, 간트

**위임 사유 템플릿**:
- Roadmap 생성
- 마일스톤 관리
- 일정 시각화

---

## Skill 직접 라우팅

| 키워드 | Skill | 조건 |
|--------|-------|------|
| 도움말, help, 사용법 | semo-help | - |
| 동기화, sync | sync-project-status | Projects 관련 |
| 작업량 설정, estimate 설정 | set-estimate | Sprint 할당 없이 작업량만 설정 |
| 작업 시작, start task | start-task | 상태+시작일+이터레이션 일괄 설정 |
| 회의 정리, 회의록, STT, 회고 정리 | summarize-meeting | STT 스크립트 + 회의록 URL 제공 시 |
| 정기회의록, 회의 템플릿, 미팅 템플릿 | generate-meeting-template | 기간 정보 기반 템플릿 생성 |
| 의사결정 로그, decision log | create-decision-log | 결정사항 기록 요청 시 |
| 테스트 요청, 테스트요청, QA 요청, QA에게 알림 | request-test | Issue 기반 테스트 요청 Slack 전송 |

---

## 복합 요청 처리

여러 키워드가 포함된 경우:

1. **우선순위**: sprint-master > progress-tracker > roadmap-planner
2. **순차 처리**: 필요시 여러 Agent 순차 호출

**예시**:
```
"Sprint 23 진행도 보여줘"
→ progress-tracker (진행도 키워드 우선)

"Sprint 생성하고 Task 할당해줘"
→ sprint-master (Sprint 키워드, 복합 작업)
```

---

## 라우팅 실패 시

키워드 매칭 실패 시:

```markdown
[SEMO] Orchestrator: 의도 분석 필요

죄송합니다. 요청을 정확히 파악하지 못했습니다.

**사용 가능한 기능**:
- Sprint 관리: "Sprint 생성", "Sprint 할당"
- 진행도 확인: "진행도", "리포트"
- Roadmap: "로드맵 생성"

더 구체적으로 말씀해주시겠어요?
```
