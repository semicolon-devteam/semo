# Workflow Knowledge Base

> orchestrator Agent의 워크플로우 참조 지식 (라우팅 실패 시 참고용)

## Semicolon Team Workflow (SDD + ADD)

```text
┌─────────────────────────────────────────────────────────────┐
│                    SPECIFICATION PHASE (SDD)                 │
├─────────────────────────────────────────────────────────────┤
│ Epic (command-center)                                        │
│   ↓                                                          │
│ Phase 1: /speckit.specify → spec.md                         │
│   ↓                                                          │
│ Phase 2: /speckit.plan → plan.md                            │
│   ↓                                                          │
│ Phase 3: /speckit.tasks → tasks.md                          │
├─────────────────────────────────────────────────────────────┤
│                   IMPLEMENTATION PHASE (ADD)                 │
├─────────────────────────────────────────────────────────────┤
│ Phase 4: /speckit.implement                                  │
│   ├─ v0.0.x: CONFIG (dependencies, spikes)                  │
│   ├─ v0.1.x: PROJECT (DDD scaffolding)                      │
│   ├─ v0.2.x: TESTS (Repository, Hooks, Components tests)    │
│   ├─ v0.3.x: DATA (Models, Supabase schemas)                │
│   └─ v0.4.x: CODE (Repository → API Client → Hooks → UI)    │
├─────────────────────────────────────────────────────────────┤
│                    VERIFICATION PHASE                        │
├─────────────────────────────────────────────────────────────┤
│ Phase 5: skill:verify → PR                                   │
│   ↓                                                          │
│ skill:git-workflow → PR 생성                                 │
└─────────────────────────────────────────────────────────────┘
```

## Agent/Skill Routing Table

| Current State             | Next Action                      | Agent/Skill to Invoke                           |
| ------------------------- | -------------------------------- | ----------------------------------------------- |
| **Issue URL 할당 (신규)** | **브랜치 생성 → Speckit 가이드** | **`skill:git-workflow` (issue-onboarding)**     |
| Epic 있음, spec 없음      | 명세 작성                        | `spec-master` or `/speckit.specify`             |
| spec.md 있음, plan 없음   | 기술 계획                        | `/speckit.plan`                                 |
| plan.md 있음, tasks 없음  | 태스크 분해                      | `/speckit.tasks`                                |
| tasks.md 있음, 코드 없음  | 구현 시작                        | `implementation-master` or `/speckit.implement` |
| 구현 중 (v0.x.x)          | 다음 Phase                       | `implementation-master`                         |
| 구현 완료                 | 검증                             | `quality-master` or `skill:verify`              |
| 검증 완료                 | PR 생성                          | `skill:git-workflow`                            |
| 기술 불확실               | 스파이크                         | `spike-master`                                  |
| 개념 질문                 | 교육                             | `teacher`                                       |
| 방법론 질문               | 조언                             | `advisor`                                       |

## Decision Tree

```text
사용자: "이제 뭐 하면 돼?"
         │
         ▼
    ┌─────────────────┐
    │ 브랜치 확인     │
    │ (이슈 번호 추출) │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ specs/ 확인     │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
spec 없음         spec 있음
    │                 │
    ▼                 ▼
"spec-master     plan 확인
 호출 권장"          │
              ┌──────┴──────┐
              │             │
              ▼             ▼
         plan 없음      plan 있음
              │             │
              ▼             ▼
         "/speckit.plan  tasks 확인
          실행 권장"         │
                     ┌──────┴──────┐
                     │             │
                     ▼             ▼
                tasks 없음    tasks 있음
                     │             │
                     ▼             ▼
                "/speckit.tasks  코드 확인
                 실행 권장"         │
                            ┌──────┴──────┐
                            │             │
                            ▼             ▼
                       코드 없음      코드 있음
                            │             │
                            ▼             ▼
                       "implementation  검증 단계
                        -master 호출"   확인
                                         │
                                         ▼
                                    "quality-master
                                     또는 PR 생성"
```

## Workflow Questions (Routing Failure Case)

> ⚠️ 워크플로우 관련 질문은 현재 전담 Agent가 없습니다.

**워크플로우 질문 예시**:

- `다음 뭐해?`, `진행 상황?`, `이제 뭐 하면 돼?`
- Issue URL과 함께 온보딩 요청

**라우팅 실패 시 응답**:

```markdown
[SAX] Orchestrator: 라우팅 실패 → 적절한 Agent 없음 (워크플로우 안내)

⚠️ **직접 처리 필요**

워크플로우 안내 전담 Agent가 없습니다.

**요청 유형**: 워크플로우 상태 확인
**처리 방법**:

1. 새 Agent 생성 (권장: `Semicolon AX 워크플로우 가이드 에이전트 만들어줘`)
2. 또는 아래 Knowledge Base 참고하여 Claude Code가 직접 처리

어떻게 진행할까요?
```
