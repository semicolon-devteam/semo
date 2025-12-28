# /SEMO:routing-map

SEMO 설치 현황 및 라우팅 구조를 시각화합니다.

## 호출

```text
skill:routing-map
```

## 기능

1. **버전 정보**: semo-core 버전 표시
2. **Runtime 정보**: 감지된 Runtime 및 References 경로
3. **라우팅 구조**: CLAUDE.md → Orchestrator → Skill 경로
4. **컴포넌트 목록**: 사용 가능한 Agent, Skill 전체 목록

## 출력 예시

```markdown
[SEMO] Skill: routing-map 호출

## SEMO 설치 현황 (v4.0)

**환경**: Meta 설치됨
**스캔 일시**: 2025-12-28

### Core Component

| 구성 요소 | 버전 | 내용 |
|----------|------|------|
| semo-core | 2.0.0 | 166개 스킬, 41개 에이전트 통합 |

### 감지된 Runtime

| 항목 | 값 |
|------|-----|
| Primary | nextjs |
| 감지 방식 | auto (next.config.ts) |
| References | references/runtimes/nextjs/ |

## Routing Structure

CLAUDE.md (Entry Point)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                           │
│                  (Runtime 자동 감지)                         │
└─────────────────────────────────────────────────────────────┘
    │
    ├── [코드 작성] ──────────► skill:implement
    ├── [테스트] ────────────► skill:tester
    ├── [커밋/PR] ───────────► skill:git-workflow
    ├── [배포] ──────────────► skill:deployer
    ├── [슬랙 알림] ─────────► skill:notify-slack
    ├── [피드백] ────────────► skill:feedback
    │
    └── [Runtime 특화]
        ├── [Next.js] ───────► skill:nextjs-implement, scaffold-domain
        ├── [Spring] ────────► skill:spring-implement, verify-reactive
        └── [Infra] ─────────► skill:scaffold-compose, scaffold-nginx

## Available Components

### Skills (166개)

**Core (14개)**
- circuit-breaker, deployer, feedback, git-workflow, implement
- list-bugs, memory, notify-slack, planner, project-status
- semo-architecture-checker, semo-help, tester, version-updater

**Next.js (35개)**
- nextjs-implement, scaffold-domain, supabase-typegen, e2e-test
- verify, typescript-review, frontend-design, auto-validate ...

**Spring (16개)**
- spring-implement, verify-reactive, run-tests, analyze-code ...

**MS (9개)**
- create-event-schema, scaffold-service, ms-health-check ...

**Infra (11개)**
- scaffold-compose, scaffold-nginx, scaffold-workflow ...

**Biz (49개)**
- implement-mvp, design-handoff, create-epic, assign-task ...

**Ops (21개)**
- release-manager, check-service-status, analyze-tech-debt ...

**Meta (9개)**
- version-manager, package-sync, audit-semo, skill-creator ...

### Agents (41개)

- orchestrator
- nextjs-implementation-master, spring-implementation-master
- ddd-architect, mvp-architect, domain-architect
- sprint-master, epic-master, draft-task-creator
- ...

[SEMO] Skill: routing-map 완료
```

## 참조

- [Runtime Detection](../../references/_detect.md)
- [SEMO Core VERSION](../../VERSION)
- [CHANGELOG](../../CHANGELOG/)
