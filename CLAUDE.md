# SAX-PM Package Configuration

> PM/프로젝트 매니저를 위한 SAX 패키지 - Sprint 관리, 진행도 추적, 인원별 업무 관리

## Package Info

- **Package**: SAX-PM
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: docs repository (Epic/Sprint 중심)
- **Audience**: PM, 프로젝트 관리자, 팀 리드

---

## 🔴 Orchestrator-First (최우선 규칙)

> **⚠️ 이 규칙은 예외 없이 적용됩니다. 직접 처리 절대 금지.**

### 키워드 감지 시 필수 출력 (MUST)

PM 관련 요청 감지 시 **반드시** SAX 메시지를 출력해야 합니다:

| 키워드 | 위임 대상 |
|--------|----------|
| Sprint, 스프린트, 주간계획, 반복 | sprint-master |
| 할당, 배정, assign, 담당자 지정 | sprint-master (assign-task) |
| 진행도, 진척, 현황, 상태, 완료율 | progress-tracker |
| 리포트, 보고서, 주간보고, 일일보고 | progress-tracker |
| 인원별, 담당자별, 업무량 | progress-tracker |
| 로드맵, 일정, 마일스톤, 타임라인 | roadmap-planner |
| 블로커, 지연, 병목, 리스크 | progress-tracker |

**키워드 감지 시 첫 출력**:

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

> 🔴 이 메시지 없이 작업 진행 금지

**Quick Routing Table**: [agents/orchestrator/orchestrator.md](agents/orchestrator/orchestrator.md) 참조

---

## 🔴 새 세션 시작 시 초기화 (NON-NEGOTIABLE)

> **⚠️ 새 세션에서 사용자 요청 처리 전, 반드시 아래 2단계를 순서대로 실행합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### Step 1: 버전 체크

```bash
# 로컬 vs 원격 버전 비교
LOCAL=$(cat .claude/sax-pm/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/sax-pm/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

**업데이트 필요 시**: `[SAX] 업데이트 가능: {local} → {remote}. "SAX 업데이트해줘"`

### Step 2: 구조 검증 (필수)

> **⚠️ Step 1 완료 후 반드시 실행**

**스킬 호출** (폴백 체인):

1. `.claude/skills/sax-architecture-checker/SKILL.md` 존재 → 실행
2. 없으면 → `.claude/sax-core/skills/sax-architecture-checker/SKILL.md` 실행

**검증 항목**:

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 상태
- 깨진 심링크 탐지 및 자동 복구

### 초기화 완료 출력

```markdown
[SAX] 세션 초기화 완료
- 버전: {version} ✅
- 구조: 정상 ✅
```

---

## 🔴 SAX Core 필수 참조

> **모든 작업 전 sax-core 문서 및 공통 컴포넌트를 참조합니다.**

| 파일 | 용도 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |

### 공통 컴포넌트 (sax-core)

| 컴포넌트 | 유형 | 역할 |
|----------|------|------|
| `compliance-checker` | Agent | 작업 완료 후 규칙 준수 검증 |
| `version-updater` | Skill | 세션 시작 시 버전 체크 및 업데이트 |
| `notify-slack` | Skill | Slack 알림 전송 |
| `feedback` | Skill | 피드백 수집 및 GitHub 이슈 생성 |
| `sax-help` | Skill | SAX 도움말 및 팀 컨텍스트 응답 |

### 공통 커맨드 (sax-core)

| 커맨드 | 설명 | 호출 스킬 |
|--------|------|-----------|
| `/SAX:help` | SAX 도움말 | sax-help |
| `/SAX:slack` | Slack 메시지 전송 | notify-slack |
| `/SAX:update` | SAX 업데이트 | version-updater |
| `/SAX:feedback` | 피드백 제출 | feedback |

---

## PM 워크플로우

### SAX-PO vs SAX-PM 역할

```
SAX-PO (기획)              SAX-PM (관리)
─────────────              ─────────────
Epic 생성          ───→    Sprint Backlog 추가
    ↓                           ↓
Draft Task 생성    ───→    Sprint 할당
    ↓                           ↓
Ready Task         ───→    Progress 추적
                                ↓
                           리포트 생성
                                ↓
                           Slack 알림
```

### Sprint 주기 (2주)

| 단계 | 시점 | 활동 |
|------|------|------|
| **계획** | Week 1 시작 | Sprint 목표 수립, Task 선정 |
| **할당** | Week 1 시작 | 담당자 배정, 용량 확인 |
| **추적** | Week 1-2 | Daily 진행도 모니터링 |
| **마감** | Week 2 종료 | Sprint 종료, 회고, Velocity 계산 |

### GitHub 연동

| 항목 | 사용 방식 |
|------|----------|
| **Projects #1** | 이슈관리 - Epic/Task Kanban |
| **Milestone** | Sprint 단위 그룹화 |
| **Labels** | `sprint-N`, `in-progress`, `blocked` |

---

## Agents 요약

| Agent | 역할 | 주요 Skills |
|-------|------|-------------|
| **orchestrator** | 요청 라우팅 | - |
| **sprint-master** | Sprint 계획/관리 | create-sprint, close-sprint, assign-to-sprint, assign-task |
| **progress-tracker** | 진행도 추적/리포팅 | generate-progress-report, generate-member-report, detect-blockers |
| **roadmap-planner** | 장기 일정/Roadmap | generate-roadmap, sync-project-status |

---

## Skills 요약

| Skill | 역할 | 통합 기능 |
|-------|------|----------|
| **assign-task** | Task 할당 통합 워크플로우 | 담당자 지정 + 작업 포인트 설정 + Slack 알림 |
| **set-estimate** | 작업 포인트 설정 | 피보나치 기반 작업량 설정 |
| **assign-to-sprint** | Sprint 할당 | 이터레이션 필드 설정 + 용량 체크 |
| **start-task** | 작업 시작 | 상태 변경 + 시작일 + 현재 이터레이션 |
| **create-sprint** | Sprint 생성 | 이터레이션 생성 + 목표 설정 |
| **close-sprint** | Sprint 종료 | 완료 처리 + Velocity 계산 |
| **calculate-velocity** | Velocity 계산 | 스프린트별 완료 포인트 분석 |
| **generate-progress-report** | 진행도 리포트 | Sprint 현황 + 완료율 |
| **generate-member-report** | 인원별 리포트 | 담당자별 업무량/진행도 |
| **detect-blockers** | 블로커 감지 | 지연/위험 Task 자동 탐지 |
| **audit-issues** | 이슈 감사 | 미할당/미추정 Task 탐지 |

---

## Commands 요약

| Command | 기능 |
|---------|------|
| `/SAX:sprint` | Sprint 생성, 할당, 종료 |
| `/SAX:progress` | 진행도 조회 |
| `/SAX:report` | 주간/인원별 리포트 생성 |
| `/SAX:roadmap` | Roadmap 생성 |

---

## References

- [Orchestrator Routing Table](agents/orchestrator/references/routing-table.md)
- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
