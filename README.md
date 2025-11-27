# SAX-Next

> Next.js 개발자를 위한 SAX 패키지

## Overview

SAX-Next는 Next.js 프로젝트 개발을 지원하는 AI 에이전트 패키지입니다. DDD 아키텍처, Supabase 연동, 코드 구현 등을 지원합니다.

**대상 사용자**:
- Next.js 개발자
- 프론트엔드 개발자
- 풀스택 개발자

## Installation

### As Git Submodule (권장)

```bash
# sax-core 먼저 설치 (필수)
git submodule add https://github.com/semicolon-devteam/sax-core.git .claude/sax-core

# sax-next 설치
git submodule add https://github.com/semicolon-devteam/sax-next.git .claude/sax-next
```

### Update

```bash
git submodule update --remote .claude/sax-next
```

## Structure

```text
sax-next/
├── CLAUDE.md              # 패키지 설정
├── agents/                # 개발 전용 Agents
│   ├── orchestrator/
│   ├── implementation-master/
│   ├── quality-master/
│   ├── ddd-architect/
│   ├── database-master.md
│   ├── spec-master.md
│   └── ...
├── skills/                # 개발 전용 Skills
│   ├── implement/
│   ├── verify/
│   ├── scaffold-domain/
│   ├── fetch-supabase-example/
│   └── ...
└── commands/              # Slash Commands
```

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 요청 라우팅 |
| implementation-master | 코드 구현 |
| quality-master | 품질 검증 |
| ddd-architect | DDD 아키텍처 설계 |
| database-master | 데이터베이스 설계 |
| spec-master | 기술 스펙 작성 |
| migration-master | 마이그레이션 관리 |
| spike-master | 기술 스파이크 |
| semicolon-reviewer | 코드 리뷰 |
| advisor | 기술 조언 |
| teacher | 학습 지원 |

## Skills

| Skill | 역할 |
|-------|------|
| implement | 코드 구현 |
| verify | 구현 검증 |
| scaffold-domain | 도메인 스캐폴딩 |
| fetch-supabase-example | Supabase 예제 조회 |
| fetch-api-spec | API 스펙 조회 |
| git-workflow | Git 워크플로우 |
| validate-architecture | 아키텍처 검증 |
| check-team-codex | Team Codex 확인 |

## Commands

- `/SAX:help` - SAX 도움말
- `/SAX:health-check` - 상태 점검
- `/SAX:task-progress` - 작업 진행 현황

## Dependencies

- **sax-core**: 필수 (../sax-core 참조)

## References

- [SAX Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [SAX Core](https://github.com/semicolon-devteam/sax-core)
