# Multi-Agent Orchestration - Sync Layer Specification

## Background

Epic 1에서 에이전트/스킬 정의를 DB에 저장하는 스키마를 구축했다.
이제 DB에 저장된 정의를 Claude Code 세션이 사용할 수 있도록 파일 시스템으로 동기화해야 한다.

## Problem Statement

1. **DB-파일 간 불일치**: DB에 저장된 에이전트 정의가 실제 `.claude/agents/` 파일과 동기화되지 않음
2. **Office 초기화 누락**: 새 Office 생성 시 기본 템플릿이 자동으로 복사되지 않음
3. **정의 수정 불가**: 웹 UI에서 에이전트/스킬 정의를 수정할 API가 없음

## Goals & Non-goals

### Goals
- **Primary**: DB → 파일 단방향 동기화 서비스 구현 (`AgentDefinitionSync`)
- **Secondary**: Office 생성 시 기본 템플릿 자동 복사
- **Tertiary**: 에이전트/스킬 정의 CRUD REST API 구현

### Non-goals
- 파일 → DB 역동기화 (수동 관리 영역)
- 실시간 파일 감시 (세션 시작 시점에만 동기화)

## User Stories

### US1: 세션 시작 시 에이전트 정의가 파일로 동기화된다
**As a** Office Server
**I want to** 에이전트 세션 시작 전 DB 정의를 worktree에 동기화
**So that** Claude Code가 최신 에이전트 정의를 사용할 수 있다

### US2: 새 Office에 기본 에이전트가 자동 생성된다
**As a** Office 생성자
**I want to** 기본 에이전트 6개와 스킬 3개가 자동으로 생성되길
**So that** 처음부터 설정하지 않아도 바로 시작할 수 있다

### US3: 관리자가 API로 에이전트 정의를 수정한다
**As an** Office 관리자
**I want to** REST API로 에이전트 정의를 조회/수정
**So that** 웹 UI에서 에이전트를 커스터마이징할 수 있다

## Technical Constraints

### 동기화 방향
- **단방향**: DB → 파일 (DB가 Source of Truth)
- **시점**: 에이전트 세션 시작 전

### 파일 시스템 구조
```
worktree/.claude/
├── CLAUDE.md              # 자동 생성 (Orchestrator 참조)
├── agents/
│   ├── orchestrator.md    # DB에서 동기화
│   ├── po.md
│   └── ...
└── skills/
    ├── write-code/
    │   ├── SKILL.md       # DB에서 동기화
    │   └── references/
    └── ...
```

## Acceptance Criteria

- [ ] `AgentDefinitionSync.syncToWorktree(officeId, worktreePath)` 구현
- [ ] `.claude/agents/*.md` 파일 생성
- [ ] `.claude/skills/*/SKILL.md` 파일 생성
- [ ] `.claude/skills/*/references/` 디렉토리 생성 (있는 경우)
- [ ] `.claude/CLAUDE.md` 자동 생성
- [ ] `initializeOfficeDefinitions(officeId)` 구현
- [ ] Office 생성 API에 초기화 로직 통합
- [ ] `GET /api/offices/:id/agent-definitions` API
- [ ] `PUT /api/offices/:id/agent-definitions/:name` API
- [ ] `GET /api/offices/:id/skill-definitions` API
- [ ] `PUT /api/offices/:id/skill-definitions/:name` API
