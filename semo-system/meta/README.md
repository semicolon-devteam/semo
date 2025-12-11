# SEMO-Meta

> SEMO 패키지 자체 관리 및 개발을 위한 메타 패키지

## Overview

SEMO-Meta는 SEMO 프레임워크를 개발하고 관리하는 데 사용되는 메타 패키지입니다.

**대상 사용자**:
- SEMO 개발자: SEMO 프레임워크를 개선하고 확장하는 개발자
- 패키지 관리자: SEMO 패키지 구조, 버저닝, 배포를 담당하는 관리자

## Installation

### As Git Submodule (권장)

```bash
# semo-core 먼저 설치 (필수)
git submodule add https://github.com/semicolon-devteam/semo-core.git .claude/semo-core

# semo-meta 설치
git submodule add https://github.com/semicolon-devteam/semo-meta.git .claude/semo-meta
```

## Structure

```text
semo-meta/
├── CLAUDE.md              # 패키지 설정
├── agents/                # SEMO 관리 Agents
│   ├── orchestrator.md
│   ├── semo-architect.md
│   ├── agent-manager/
│   ├── skill-manager/
│   └── command-manager/
├── skills/                # SEMO 관리 Skills
│   ├── package-validator/
│   ├── version-manager/
│   ├── package-sync/
│   └── package-deploy/
├── scripts/               # 자동화 스크립트
└── templates/             # 템플릿 파일
```

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | SEMO 메타 작업 라우팅 |
| semo-architect | SEMO 패키지 설계 |
| agent-manager | Agent 라이프사이클 관리 |
| skill-manager | Skill 라이프사이클 관리 |
| command-manager | Command 라이프사이클 관리 |

## Skills

| Skill | 역할 |
|-------|------|
| package-validator | SEMO 패키지 구조 검증 |
| version-manager | SEMO 버저닝 자동화 |
| package-sync | 패키지 소스 → .claude 동기화 |
| package-deploy | 외부 프로젝트 SEMO 배포 |

## Dependencies

- **semo-core**: 필수 (../semo-core 참조)

## References

- [SEMO Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [SEMO Core](https://github.com/semicolon-devteam/semo-core)
