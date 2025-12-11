# SAX Packaging Guide

> SAX 패키지 정의 및 레포지토리별 구성 가이드

## 1. 패키지 정의

### 1.1 공식 패키지 목록

| Package | 대상 레포 | 역할 | 상태 |
|---------|----------|------|------|
| **SAX-Core** | docs/sax/core/ | 공통 원칙, 규칙 | Active |
| **SAX-Meta** | docs | SAX 패키지 관리 | Active |
| **SAX-PO** | docs | PO/기획자용 에이전트 | Active |
| **SAX-Next** | cm-template, cm-* | Next.js 개발용 | Active |
| **SAX-Spring** | core-backend | Spring Boot 개발용 | Planned |

### 1.2 패키지 계층 구조

```text
SAX-Core (docs/sax/core/)
│
│   ┌─────────────────────────────────────────┐
│   │ 공통 요소                                │
│   │ - PRINCIPLES.md (기본 원칙)              │
│   │ - MESSAGE_RULES.md (메시지 규칙)         │
│   │ - PACKAGING.md (패키지 가이드)           │
│   │ - TEAM_RULES.md (팀 규칙)               │
│   └─────────────────────────────────────────┘
│
├── SAX-Meta (docs)
│   │ ┌─────────────────────────────────────────┐
│   │ │ SAX 패키지 관리 전용                     │
│   │ │ - agents/orchestrator.md                │
│   │ │ - agents/sax-architect.md               │
│   │ │ - agents/agent-manager/                 │
│   │ │ - agents/skill-manager/                 │
│   │ │ - skills/package-validator/             │
│   │ │ - skills/version-manager/               │
│   │ │ - skills/package-sync/                  │
│   │ │ - skills/package-deploy/                │
│   │ └─────────────────────────────────────────┘
│
├── SAX-PO (docs)
│   │ ┌─────────────────────────────────────────┐
│   │ │ PO 전용 요소                            │
│   │ │ - agents/orchestrator.md                │
│   │ │ - agents/epic-master.md                 │
│   │ │ - agents/draft-task-creator.md          │
│   │ │ - agents/spec-writer.md                 │
│   │ │ - agents/onboarding-master.md           │
│   │ │ - agents/teacher.md                     │
│   │ │ - skills/health-check/                  │
│   │ │ - skills/assign-project-label/          │
│   │ │ - skills/check-team-codex/              │
│   │ │ - ... (13개 Skills)                     │
│   │ └─────────────────────────────────────────┘
│
├── SAX-Next (cm-template, cm-*)
│   │ ┌─────────────────────────────────────────┐
│   │ │ Next.js 개발 전용 요소                   │
│   │ │ - agents/orchestrator/                  │
│   │ │ - agents/spec-master.md                 │
│   │ │ - agents/database-master.md             │
│   │ │ - agents/advisor.md                     │
│   │ │ - agents/teacher.md                     │
│   │ │ - agents/onboarding-master.md           │
│   │ │ - skills/implement/                     │
│   │ │ - skills/spec/                          │
│   │ │ - skills/verify/                        │
│   │ │ - skills/scaffold-domain/               │
│   │ │ - skills/fetch-supabase-example/        │
│   │ │ - ... (17개 Skills)                     │
│   │ └─────────────────────────────────────────┘
│
└── SAX-Spring (core-backend) [Planned]
    │ ┌─────────────────────────────────────────┐
    │ │ Spring Boot 개발 전용 요소              │
    │ │ - agents/spring-master.md               │
    │ │ - agents/api-designer.md                │
    │ │ - skills/entity-generator/              │
    │ │ - skills/rpc-generator/                 │
    │ └─────────────────────────────────────────┘
```

---

## 2. SAX-Core (docs/sax/core/)

### 2.1 역할

- SAX 기본 원칙 정의 (Single Source of Truth)
- 공통 메시지 규칙 정의
- 패키지 표준 정의
- 팀 규칙 정의

### 2.2 디렉토리 구조

```text
docs/sax/core/
├── PRINCIPLES.md       # SAX 기본 원칙
├── MESSAGE_RULES.md    # 메시지 포맷 규칙
├── PACKAGING.md        # 패키지 가이드 (이 문서)
└── TEAM_RULES.md       # 팀 규칙
```

### 2.3 배포 방식

SAX-Core는 각 패키지와 함께 `.claude/sax-core/` 디렉토리로 배포됩니다:

```bash
# deploy.sh 실행 시 자동으로 sax-core도 함께 배포
./sax/scripts/deploy.sh sax-next /path/to/project

# 결과 구조
/path/to/project/.claude/
├── sax-core/           # Core 규칙 (자동 배포)
│   ├── PRINCIPLES.md
│   ├── MESSAGE_RULES.md
│   ├── PACKAGING.md
│   └── TEAM_RULES.md
└── sax-next/           # 패키지
    ├── CLAUDE.md
    ├── agents/
    └── skills/
```

### 2.4 참조 방법

각 패키지의 CLAUDE.md에서 Core 참조:

```markdown
# CLAUDE.md에서

## SAX Core 상속

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md
```

**외부 레포지토리에서 원격 참조 (필요시)**:

```bash
gh api repos/semicolon-devteam/docs/contents/sax/core/PRINCIPLES.md \
  --jq '.content' | base64 -d
```

---

## 3. SAX-Meta (docs)

### 3.1 역할

- SAX 패키지 자체 관리 및 개발
- Agent/Skill/Command 라이프사이클 관리
- 버저닝 및 배포 자동화

### 3.2 대상 사용자

- SAX 개발자
- SAX 패키지 관리자

### 3.3 주요 컴포넌트

| 유형 | 이름 | 역할 |
|------|------|------|
| Agent | orchestrator | 요청 라우팅 |
| Agent | sax-architect | SAX 패키지 설계 |
| Agent | agent-manager | Agent 라이프사이클 관리 |
| Agent | skill-manager | Skill 라이프사이클 관리 |
| Skill | package-validator | 패키지 구조 검증 |
| Skill | version-manager | 버저닝 자동화 |
| Skill | package-sync | 패키지 동기화 |
| Skill | package-deploy | 외부 프로젝트 배포 |

---

## 4. SAX-PO (docs)

### 4.1 역할

- PO/기획자가 Epic 생성
- Draft Task 생성
- GitHub Issues 관리

### 4.2 대상 사용자

- Product Owner (PO)
- 기획자
- 프로젝트 매니저

### 4.3 주요 컴포넌트

| 유형 | 이름 | 역할 |
|------|------|------|
| Agent | orchestrator | 요청 라우팅 |
| Agent | epic-master | Epic 생성 |
| Agent | draft-task-creator | Draft Task 생성 |
| Agent | spec-writer | Spec 초안 작성 |
| Agent | onboarding-master | 신규 사용자 온보딩 |
| Agent | teacher | 학습 안내 |
| Skill | health-check | 환경 검증 |
| Skill | assign-project-label | 프로젝트 라벨 할당 |
| Skill | check-team-codex | 팀 규칙 검증 |
| ... | ... | (총 13개 Skills) |

---

## 5. SAX-Next (cm-template, cm-*)

### 5.1 역할

- Next.js 기반 프론트엔드 개발
- DDD 아키텍처 구현
- Supabase 연동

### 5.2 대상 사용자

- 프론트엔드 개발자
- 풀스택 개발자

### 5.3 주요 컴포넌트

| 유형 | 이름 | 역할 |
|------|------|------|
| Agent | orchestrator | 요청 라우팅 |
| Agent | spec-master | SDD Phase 1-3 |
| Agent | database-master | DB 및 Supabase 통합 |
| Agent | advisor | 조언 제공 |
| Agent | teacher | 학습 안내 |
| Agent | onboarding-master | 신규 개발자 온보딩 |
| Skill | implement | ADD 구현 워크플로우 |
| Skill | spec | SDD 명세 워크플로우 |
| Skill | verify | 품질 검증 |
| Skill | scaffold-domain | DDD 도메인 스캐폴딩 |
| Skill | fetch-supabase-example | Supabase 예제 참조 |
| ... | ... | (총 17개 Skills) |

---

## 6. SAX-Spring (core-backend) [Planned]

### 6.1 역할

- Spring Boot 백엔드 개발
- API 설계 및 구현
- 데이터베이스 엔티티 관리

### 6.2 대상 사용자

- 백엔드 개발자

### 6.3 예상 컴포넌트

| 유형 | 이름 | 역할 |
|------|------|------|
| Agent | orchestrator | 요청 라우팅 |
| Agent | spring-master | Spring 구현 담당 |
| Agent | api-designer | API 설계 |
| Skill | entity-generator | JPA Entity 생성 |
| Skill | rpc-generator | RPC 함수 생성 |

---

## 7. 패키지 CLAUDE.md 템플릿

### 7.1 기본 구조 (Core 참조 방식)

```markdown
# CLAUDE.md

## SAX Configuration

**Package**: SAX-{PackageName}
**Version**: 📌 [sax/VERSION](https://github.com/semicolon-devteam/docs/blob/main/sax/VERSION) 참조
**Extends**: SAX-Core

## SAX Core 상속

이 패키지는 SAX Core의 기본 원칙을 상속합니다.

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md

## 패키지 전용 에이전트

| Agent | 역할 |
|-------|------|
| ... | ... |

## 패키지 전용 스킬

| Skill | 역할 |
|-------|------|
| ... | ... |

## 프로젝트 컨텍스트

...
```

---

## 8. 패키지 간 통신

### 8.1 로컬 Core 참조 (권장)

배포된 환경에서는 `.claude/sax-core/` 직접 참조:

```markdown
@sax-core/PRINCIPLES.md
```

### 8.2 원격 Core 참조 (필요시)

docs 레포에 직접 접근이 필요한 경우:

```bash
gh api repos/semicolon-devteam/docs/contents/sax/core/{filename} \
  --jq '.content' | base64 -d
```

### 8.3 패키지 간 의존성

```yaml
SAX-Meta:
  depends_on:
    - SAX-Core

SAX-PO:
  depends_on:
    - SAX-Core

SAX-Next:
  depends_on:
    - SAX-Core
  optional:
    - SAX-PO  # Epic 참조 시

SAX-Spring:
  depends_on:
    - SAX-Core
  optional:
    - SAX-Next  # API 연동 시
```

---

## 9. 배포 가이드

### 9.1 deploy.sh 사용 (권장)

```bash
# docs 레포 경로에서 실행
cd /path/to/semicolon/docs

# 신규 설치 (sax-core 자동 포함)
./sax/scripts/deploy.sh sax-next /path/to/project

# 업데이트
./sax/scripts/deploy.sh sax-next /path/to/project --update
```

### 9.2 배포 결과 구조

```text
/path/to/project/.claude/
├── CLAUDE.md              # 루트 설정 (사용자 작성)
├── sax-core/              # Core 규칙 (자동 배포)
│   ├── PRINCIPLES.md
│   ├── MESSAGE_RULES.md
│   ├── PACKAGING.md
│   └── TEAM_RULES.md
├── sax-next/              # 패키지 설정
│   └── CLAUDE.md
├── agents/                # 패키지 Agents
│   ├── orchestrator/
│   ├── spec-master.md
│   └── ...
└── skills/                # 패키지 Skills
    ├── implement/
    ├── verify/
    └── ...
```

### 9.3 버전 업그레이드

1. CHANGELOG 확인: `gh api repos/semicolon-devteam/docs/contents/sax/CHANGELOG/INDEX.md --jq '.content' | base64 -d`
2. Breaking Changes 검토
3. deploy.sh --update 실행
4. 커밋: `git commit -m "📝 [SAX] Sync to vX.X.X"`

---

## 10. 참조

- [SAX Principles](./PRINCIPLES.md)
- [Message Rules](./MESSAGE_RULES.md)
- [Team Rules](./TEAM_RULES.md)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
