# SEMO-PO

> PO(Product Owner) 및 기획자를 위한 SEMO 패키지

## Overview

SEMO-PO는 제품 기획, Epic 관리, 스펙 작성 등 PO/기획자 업무를 지원하는 AI 에이전트 패키지입니다.

**대상 사용자**:
- Product Owner
- 기획자
- 프로젝트 매니저

## Installation

### As Git Submodule (권장)

```bash
# semo-core 먼저 설치 (필수)
git submodule add https://github.com/semicolon-devteam/semo-core.git .claude/semo-core

# semo-po 설치
git submodule add https://github.com/semicolon-devteam/semo-po.git .claude/semo-po
```

### Update

```bash
git submodule update --remote .claude/semo-po
```

## Structure

```text
semo-po/
├── CLAUDE.md              # 패키지 설정
├── agents/                # PO 전용 Agents
│   ├── orchestrator.md
│   ├── epic-master.md
│   ├── draft-task-creator.md
│   ├── spec-writer.md
│   ├── teacher.md
│   └── onboarding-master.md
├── skills/                # PO 전용 Skills
│   ├── create-epic/
│   ├── check-team-codex/
│   ├── health-check/
│   └── ...
├── commands/              # Slash Commands
│   ├── SAX/
│   └── BMad/
└── templates/             # 템플릿 파일
```

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 요청 라우팅 |
| epic-master | Epic 생성 및 관리 |
| draft-task-creator | Draft Task 생성 |
| spec-writer | Spec 문서 작성 |
| teacher | SEMO 사용법 교육 |
| onboarding-master | 신규 팀원 온보딩 |

## Skills

| Skill | 역할 |
|-------|------|
| create-epic | Epic 이슈 생성 |
| check-team-codex | Team Codex 확인 |
| health-check | SEMO 상태 점검 |
| assign-project-label | 프로젝트 라벨 할당 |
| detect-project-from-epic | Epic에서 프로젝트 감지 |

## Commands

### /SEMO Commands

- `/SEMO:help` - SEMO 도움말
- `/SEMO:health-check` - 상태 점검
- `/SEMO:onboarding` - 온보딩 시작

### /BMad Commands

BMad 에이전트 시스템 (고급 분석/기획)

## Dependencies

- **semo-core**: 필수 (../semo-core 참조)

## References

- [SEMO Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [SEMO Core](https://github.com/semicolon-devteam/semo-core)
