# SAX-Next Package Configuration

> Next.js 개발자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-Next
- **Version**: 📌 [sax/VERSION](https://github.com/semicolon-devteam/docs/blob/main/sax/VERSION) 참조
- **Target**: cm-template, cm-\* 프로젝트 (Next.js 기반)
- **Audience**: Frontend/Fullstack 개발자
- **Extends**: SAX-Core

## SAX Core 상속

이 패키지는 SAX Core의 기본 원칙을 상속합니다.

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md

> 📖 Core 문서는 `.claude/sax-core/` 디렉토리에서 자동 로드됩니다.

## Workflow: SDD + ADD

### SDD (Spec-Driven Development) - Phase 1-3

```text
/speckit.specify → specs/{domain}/spec.md
/speckit.plan → specs/{domain}/plan.md
/speckit.tasks → specs/{domain}/tasks.md
```

### ADD (Agent-Driven Development) - Phase 4

```text
v0.0.x CONFIG → 환경 설정
v0.1.x PROJECT → 도메인 구조 생성
v0.2.x TESTS → TDD 테스트 작성
v0.3.x DATA → 타입, 인터페이스 정의
v0.4.x CODE → 구현 코드 작성
```

### Verification - Phase 5

```text
skill:verify → 종합 검증
skill:check-team-codex → 팀 코덱스 준수 확인
skill:validate-architecture → DDD 아키텍처 검증
```

## Architecture: DDD 4-Layer

```text
src/app/{domain}/
├── _repositories/     # 서버사이드 데이터 접근 (Layer 1)
├── _api-clients/      # 브라우저 HTTP 통신 (Layer 2)
├── _hooks/            # React 상태 관리 (Layer 3)
├── _components/       # 도메인 전용 UI (Layer 4)
└── page.tsx
```

## Package Components

### Agents

| Agent | 역할 | 파일 |
|-------|------|------|
| orchestrator | 요청 라우팅 | `agents/orchestrator/` |
| spec-master | SDD Phase 1-3 | `agents/spec-master.md` |
| database-master | DB 및 Supabase 통합 | `agents/database-master.md` |
| advisor | 조언 제공 | `agents/advisor.md` |
| teacher | 학습 안내 | `agents/teacher.md` |
| onboarding-master | 신규 개발자 온보딩 | `agents/onboarding-master.md` |

### Skills

| Skill | 역할 | 파일 |
|-------|------|------|
| health-check | 개발 환경 검증 | `skills/health-check/` |
| task-progress | 워크플로우 진행도 확인 | `skills/task-progress/` |
| spec | SDD 명세 워크플로우 | `skills/spec/` |
| implement | ADD 구현 워크플로우 | `skills/implement/` |
| verify | Phase 5 종합 검증 | `skills/verify/` |
| check-team-codex | 팀 코덱스 검증 | `skills/check-team-codex/` |
| validate-architecture | DDD 아키텍처 검증 | `skills/validate-architecture/` |
| scaffold-domain | 도메인 구조 생성 | `skills/scaffold-domain/` |
| fetch-supabase-example | Supabase 패턴 참조 | `skills/fetch-supabase-example/` |
| git-workflow | Git 워크플로우 자동화 | `skills/git-workflow/` |
| create-issues | GitHub Issues 생성 | `skills/create-issues/` |
| project-kickoff | 프로젝트 시작 가이드 | `skills/project-kickoff/` |
| migration-analyzer | 마이그레이션 분석 | `skills/migration-analyzer/` |
| constitution | 프로젝트 헌법 | `skills/constitution/` |

### Commands

| Command | 역할 | 파일 |
|---------|------|------|
| /SAX:onboarding | 신규 개발자 온보딩 | `commands/onboarding.md` |
| /SAX:health-check | 개발 환경 검증 | `commands/health-check.md` |
| /SAX:task-progress | 워크플로우 진행도 확인 | `commands/task-progress.md` |
| /SAX:help | 대화형 도우미 | `commands/help.md` |

## PO 연동 (SAX-PO)

SAX-PO에서 생성된 Epic은 다음과 같이 연동됩니다:

1. **PO (SAX-PO)**: Epic 생성 → docs 레포에 이슈 생성
2. **PO (SAX-PO)**: (선택) Spec 초안 생성
3. **개발자 (SAX-Next)**: `/speckit.specify`로 spec.md 보완
4. **개발자 (SAX-Next)**: `/speckit.plan`, `/speckit.tasks`
5. **개발자 (SAX-Next)**: `skill:implement`로 구현
6. **개발자 (SAX-Next)**: `skill:verify`로 검증

## Installation & Update

### 설치 방법

```bash
# docs 레포에서 deploy.sh 사용 (권장)
cd /path/to/semicolon/docs
./sax/scripts/deploy.sh sax-next /path/to/project

# 또는 수동 설치
cd /path/to/project
mkdir -p .claude
cp -r /path/to/docs/sax/core .claude/sax-core
cp -r /path/to/docs/sax/packages/sax-next/* .claude/
```

### 업데이트 후 커밋 규칙

> ⚠️ **중요**: SAX 패키지 동기화(업데이트) 완료 후 **반드시 커밋**을 수행합니다.

**커밋 메시지 형식**:

```text
📝 [SAX] Sync to vX.X.X
```

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
- [SAX Core - Packaging](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PACKAGING.md)
- [SAX Changelog Index](https://github.com/semicolon-devteam/docs/blob/main/sax/CHANGELOG/INDEX.md)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)
