# SEMO v5.0 Architecture Design

> AI Agent Orchestration Framework - 대규모 개편 설계서

**작성일**: 2025-12-29
**버전**: Draft 1.0
**상태**: 설계 완료, 구현 대기

---

## Executive Summary

SEMO v5.0은 다음 핵심 변화를 포함합니다:

| 영역 | 변경 | 효과 |
|------|------|------|
| **Agent** | 페르소나 기반 14개 Agent 신규 구성 | 역할별 전문성, 토론 가능 |
| **Skill** | 175개 → ~50개 통합 | 중복 제거, 관리 용이 |
| **Script** | 반복 작업 스크립트 분리 | 재사용성, 테스트 용이 |
| **Package** | semo-hooks 흡수, 레거시 정리 | 관리 단순화 |

---

## 1. Architecture Overview

### 1.1 Core Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMO v5.0 Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User Request                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   Orchestrator                       │   │
│   │              (Intent Analysis & Routing)             │   │
│   └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ├─────────────────┬─────────────────┐               │
│        │                 │                 │               │
│        ▼                 ▼                 ▼               │
│   ┌─────────┐       ┌─────────┐       ┌─────────┐         │
│   │ Agents  │       │ Skills  │       │ Scripts │         │
│   │(WHO)    │       │(WHAT)   │       │(HOW)    │         │
│   │         │       │         │       │         │         │
│   │페르소나 │       │도구/기술│       │실행코드 │         │
│   │의사결정 │       │작업수행 │       │자동화   │         │
│   └─────────┘       └─────────┘       └─────────┘         │
│        │                 │                 │               │
│        └────────────────┬┴─────────────────┘               │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  semo-core                           │   │
│   │         (Principles, References, Runtime Rules)     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Layer Structure

| Layer | 구성요소 | 역할 |
|-------|----------|------|
| **L0** | semo-core | 원칙, 오케스트레이터, runtime references |
| **L1** | semo-skills | 공통 스킬 (~50개) |
| **L2** | semo-agents | 페르소나 기반 Agent (14개) |
| **L3** | semo-scripts | 실행 스크립트 |
| **Ext** | semo-remote, meta | 선택적 확장 |

---

## 2. Agent Design

### 2.1 Agent vs Skill 분리 원칙

| 구분 | Agent | Skill |
|------|-------|-------|
| **정의** | 페르소나를 가진 의사결정자 | 특정 작업 수행 도구 |
| **호출** | 토론/검토/의사결정 필요 시 | 구체적 작업 요청 시 |
| **예시** | "QA 관점에서 검토해줘" | "테스트 실행해줘" |
| **특징** | 의견 제시, 관점 제공, 토론 | 결과 반환, 실행 |

### 2.2 Agent Roster (14개)

```
semo-agents/
├── 📋 Planning (기획)
│   ├── po.md           # Product Owner
│   ├── pm.md           # Project Manager
│   └── analyst.md      # Business Analyst
│
├── 🏗️ Architecture (설계)
│   ├── architect.md    # Software Architect
│   ├── designer.md     # UX/UI Designer
│   └── dba.md          # DB Architect
│
├── 💻 Development (개발)
│   ├── developer.md    # Developer
│   ├── reviewer.md     # Code Reviewer
│   └── tech-writer.md  # Tech Writer
│
├── 🧪 Quality (품질)
│   ├── qa.md           # QA Engineer
│   └── security.md     # Security Engineer
│
└── 🚀 Operations (운영)
    ├── devops.md       # DevOps Engineer
    ├── sre.md          # Site Reliability Engineer
    └── release.md      # Release Manager
```

### 2.3 Agent Template

```yaml
# agents/po.md

---
name: po
description: |
  Product Owner 페르소나. 요구사항, 우선순위, 사용자 가치 관점.
  Party Mode에서 비즈니스/사용자 관점 제공.
tools: [Read, Grep, Glob]
model: inherit
---

## Persona

**이름**: John (Product Owner)
**아이콘**: 📋
**역할**: 비즈니스 가치와 사용자 니즈 대변

**커뮤니케이션 스타일**:
- "WHY?"를 끊임없이 질문
- 데이터 기반 의사결정
- 사용자 스토리 중심 사고

**원칙**:
1. 사용자 가치 > 기술적 우아함
2. MVP 우선, 점진적 확장
3. 측정 가능한 목표 설정

## 역할별 Skill 사용

| 상황 | 사용 Skill |
|------|-----------|
| Epic 작성 | `epic` |
| 우선순위 결정 | `board` |
| AC 생성 | `spec` |

## Party Mode 참여 규칙

토론 시 다음 관점에서 의견 제시:
- 사용자에게 어떤 가치를 주는가?
- 비즈니스 목표와 일치하는가?
- 우선순위는 어떻게 되는가?
- ROI는 어떠한가?
```

### 2.4 Party Mode (다중 Agent 토론)

**트리거 패턴**:
- "여러 관점에서 검토해줘"
- "토론해볼까?"
- "PO랑 개발자 의견 다 듣고 싶어"

**Workflow**:

```
Phase 1: Agent 선택
├── 토픽 분석
└── 관련 Agent 2-3개 자동 선택

Phase 2: 의견 수집 (Round 1)
├── 각 Agent 순차 의견 제시
└── 입장 + 근거 + 우려사항

Phase 3: 크로스 리뷰 (Round 2)
├── 다른 Agent 의견 검토
└── 동의/반론/보완

Phase 4: 종합
├── 합의점 정리
├── 미해결 쟁점 정리
└── 권장 결론 제시

Phase 5: 사용자 결정
└── 최종 방향 선택
```

---

## 3. Skill Consolidation

### 3.1 통합 원칙

| 원칙 | 설명 |
|------|------|
| **Runtime 통합** | nextjs-*, spring-* → 단일 스킬 + 컨텍스트 주입 |
| **역할 분리** | 페르소나 로직 → Agent로 이동 |
| **세분화 병합** | 동일 도메인 스킬 → 하나로 통합 |
| **스크립트 분리** | 반복 실행 코드 → scripts/로 추출 |

### 3.2 Skill Catalog (약 50개)

```
semo-skills/
├── 🔧 Core (4개)
│   ├── circuit-breaker     # 무한루프 방지
│   ├── memory              # 컨텍스트 영속화
│   ├── semo-help           # 도움말
│   └── feedback            # 피드백 수집
│
├── 📋 Planning (4개)
│   ├── spec                # 스펙 작성
│   ├── spike               # 기술 스파이크
│   ├── epic                # Epic 관리
│   └── task                # Task 관리
│
├── 💻 Development (5개)
│   ├── implement           # 코드 구현 (runtime 자동 감지)
│   ├── scaffold            # 스캐폴딩 (domain/service/compose)
│   ├── test                # 테스트 작성/실행
│   ├── review              # 코드 리뷰
│   └── verify              # 검증 (lint/type/build)
│
├── 🔄 Git & Release (3개)
│   ├── git                 # Git 워크플로우
│   ├── release             # 릴리스 관리
│   └── deploy              # 배포
│
├── 📊 Project Management (4개)
│   ├── sprint              # 스프린트 관리
│   ├── issue               # 이슈 관리
│   ├── board               # 보드/상태 관리
│   └── report              # 보고서 생성
│
├── 🧪 QA (3개)
│   ├── request-test        # 테스트 요청
│   ├── test-cases          # 테스트케이스
│   └── bug                 # 버그 관리
│
├── 🚀 Operations (3개)
│   ├── health-check        # 헬스체크
│   ├── migrate             # DB 마이그레이션
│   └── incident            # 장애대응
│
├── 📚 Documentation (2개)
│   ├── docx                # 문서 생성
│   └── meeting             # 미팅 기록
│
└── 🔔 Communication (2개)
    ├── notify              # 알림
    └── mention             # 멘션
```

### 3.3 Runtime Context Injection

`implement` 스킬에서 자동 runtime 감지:

```markdown
## Runtime 감지 규칙

| 파일 | Runtime | References |
|------|---------|------------|
| `next.config.*` | nextjs | references/runtimes/nextjs/ |
| `build.gradle*` | spring | references/runtimes/spring/ |
| `docker-compose.*` | infra | references/runtimes/infra/ |
| `go.mod` | go-ms | references/runtimes/go-ms/ |

## 적용 예시

사용자: "사용자 조회 API 만들어줘"

[Runtime 감지: nextjs]
└── references/runtimes/nextjs/implement-rules.md 로드

[적용 규칙]
- DDD 4-layer: domain → application → infra → presentation
- Supabase 타입 사용
- Server Actions 우선
```

---

## 4. Script Extraction

### 4.1 Script 대상

| Skill | Script | 용도 |
|-------|--------|------|
| scaffold | `scripts/scaffold/domain.ts` | 디렉토리 생성 |
| test | `scripts/test/run-e2e.sh` | E2E 실행 |
| deploy | `scripts/deploy/publish-npm.sh` | npm 배포 |
| health-check | `scripts/health/check-services.sh` | 상태 체크 |
| sync | `scripts/sync/supabase-typegen.sh` | 타입 생성 |

### 4.2 Script Structure

```
semo-scripts/
├── scaffold/
│   ├── domain.ts           # DDD 도메인 스캐폴딩
│   ├── service.ts          # MS 서비스 스캐폴딩
│   └── compose.ts          # Docker Compose
│
├── test/
│   ├── run-e2e.sh          # E2E 테스트
│   └── run-unit.sh         # 유닛 테스트
│
├── deploy/
│   ├── publish-npm.sh      # npm 배포
│   └── github-release.sh   # GitHub 릴리스
│
├── sync/
│   ├── supabase-typegen.sh # Supabase 타입
│   └── openapi-codegen.sh  # OpenAPI 코드젠
│
└── health/
    └── check-services.sh   # 서비스 헬스체크
```

### 4.3 Skill-Script 연동

```markdown
# scaffold Skill (SKILL.md)

## 사용법

도메인 스캐폴딩:
`Bash: npx ts-node semo-scripts/scaffold/domain.ts --name User --layer all`

## 스크립트 옵션

| 옵션 | 설명 |
|------|------|
| --name | 도메인명 |
| --layer | 생성할 레이어 (domain/application/infra/presentation/all) |
| --runtime | 런타임 (nextjs/spring/go) |
```

---

## 5. Package Consolidation

### 5.1 목표 구조

```
semo/
├── packages/                       # npm 배포 (2개)
│   ├── cli/                        # @team-semicolon/semo-cli
│   └── mcp-server/                 # @team-semicolon/semo-mcp (hooks 흡수)
│
└── semo-system/                    # 프롬프트 시스템
    ├── semo-core/                  # L0: 원칙, 오케스트레이터
    ├── semo-skills/                # L1: 통합 스킬
    ├── semo-agents/                # L2: Agent 페르소나 (NEW)
    ├── semo-scripts/               # L3: 실행 스크립트 (NEW)
    ├── semo-remote/                # Ext: 원격 제어
    └── meta/                       # Ext: SEMO 관리
```

### 5.2 semo-hooks 흡수

**Before**:
```
packages/mcp-server/     # MCP 통합
semo-system/semo-hooks/  # 대화 로깅 (별도)
```

**After**:
```
packages/mcp-server/
├── src/
│   ├── integrations/    # Slack, GitHub, Supabase
│   ├── memory/          # 장기 기억
│   └── hooks/           # 대화 로깅 (흡수)
│       ├── conversation-logger.ts
│       ├── permission-handler.ts
│       └── notification-handler.ts
```

### 5.3 Version Bump

| 패키지 | 현재 | v5.0 |
|--------|------|------|
| semo-cli | 3.1.0 | 4.0.0 |
| semo-mcp | 2.2.0 | 3.0.0 |
| semo-core | 2.1.0 | 3.0.0 |
| semo-skills | 1.13.0 | 2.0.0 |
| semo-agents | - | 1.0.0 |
| semo-scripts | - | 1.0.0 |

---

## 6. Migration Plan

### Phase 1: Foundation (Week 1)

- [ ] semo-agents 디렉토리 생성
- [ ] semo-scripts 디렉토리 생성
- [ ] Agent 템플릿 작성 (14개)
- [ ] Party Mode 규칙 작성

### Phase 2: Skill Consolidation (Week 2-3)

- [ ] implement 통합 (nextjs/spring/mvp → 1개)
- [ ] health-check 통합 (10개 → 1개)
- [ ] PM 관련 통합 (sprint/issue/report)
- [ ] Runtime references 작성

### Phase 3: Script Extraction (Week 3)

- [ ] scaffold 스크립트 추출
- [ ] test 스크립트 추출
- [ ] deploy 스크립트 추출
- [ ] sync 스크립트 추출

### Phase 4: Package Cleanup (Week 4)

- [ ] semo-hooks → mcp-server 흡수
- [ ] packages/core, meta 삭제
- [ ] 버저닝 (v5.0.0)
- [ ] 문서 업데이트

---

## 7. Breaking Changes

### 7.1 Skill 이름 변경

| Before | After |
|--------|-------|
| `git-workflow` | `git` |
| `tester` | `test` |
| `deployer` | `deploy` |
| `notify-slack` | `notify` |
| `list-bugs` | `bug` |

### 7.2 삭제되는 Skill

- `nextjs-implement` → `implement`로 통합
- `spring-implement` → `implement`로 통합
- `*-health-check` (10개) → `health-check`로 통합
- `create-sprint`, `close-sprint` → `sprint`로 통합

### 7.3 새로운 Component

- `semo-agents/` - Agent 페르소나 저장소
- `semo-scripts/` - 실행 스크립트 저장소
- `party-mode` Skill - 다중 Agent 토론

---

## 8. References

### Best Practice Sources

- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
- [BMad Method - Party Mode](https://github.com/bmad-code-org/BMAD-METHOD)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/)
- [Multi-Agent Orchestration Patterns](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)

### Internal References

- [SEMO Principles](../semo-system/semo-core/principles/PRINCIPLES.md)
- [Current Skill Catalog](../semo-system/semo-skills/)
- [Orchestrator Rules](../semo-system/meta/agents/orchestrator/orchestrator.md)

---

## Appendix A: Full Skill Mapping

### Before → After

| Category | Before (175개) | After (~50개) |
|----------|---------------|---------------|
| Core | 14 | 4 |
| Planning | 15 | 4 |
| Development | 30 | 5 |
| Git/Release | 8 | 3 |
| PM | 25 | 4 |
| QA | 12 | 3 |
| Operations | 15 | 3 |
| Docs | 5 | 2 |
| Communication | 5 | 2 |
| Meta | 9 | 9 |
| Runtime-specific | 37 | 0 (통합) |

### Skill 상세 매핑

<details>
<summary>implement 통합 (7개 → 1개)</summary>

| Before | After |
|--------|-------|
| nextjs-implement | implement |
| spring-implement | implement |
| implement-mvp | implement |
| typescript-write | implement |
| improve-code | implement (옵션) |
| analyze-code | implement (옵션) |
| implement | implement |

</details>

<details>
<summary>health-check 통합 (10개 → 1개)</summary>

| Before | After |
|--------|-------|
| health-check | health-check |
| poc-health-check | health-check |
| qa-health-check | health-check |
| pm-health-check | health-check |
| design-health-check | health-check |
| infra-health-check | health-check |
| ms-health-check | health-check |
| spring-health-check | health-check |
| discovery-health-check | health-check |
| nextjs-health-check | health-check |

</details>

---

**문서 끝**
