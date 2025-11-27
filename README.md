# SAX-Meta

> SAX 패키지 자체 관리 및 개발을 위한 메타 패키지

## Overview

SAX-Meta는 SAX 프레임워크를 개발하고 관리하는 데 사용되는 메타 패키지입니다.

**대상 사용자**:
- SAX 개발자: SAX 프레임워크를 개선하고 확장하는 개발자
- 패키지 관리자: SAX 패키지 구조, 버저닝, 배포를 담당하는 관리자

## Installation

### As Git Submodule (권장)

```bash
# sax-core 먼저 설치 (필수)
git submodule add https://github.com/semicolon-devteam/sax-core.git .claude/sax-core

# sax-meta 설치
git submodule add https://github.com/semicolon-devteam/sax-meta.git .claude/sax-meta
```

## Structure

```text
sax-meta/
├── CLAUDE.md              # 패키지 설정
├── agents/                # SAX 관리 Agents
│   ├── orchestrator.md
│   ├── sax-architect.md
│   ├── agent-manager/
│   ├── skill-manager/
│   └── command-manager/
├── skills/                # SAX 관리 Skills
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
| orchestrator | SAX 메타 작업 라우팅 |
| sax-architect | SAX 패키지 설계 |
| agent-manager | Agent 라이프사이클 관리 |
| skill-manager | Skill 라이프사이클 관리 |
| command-manager | Command 라이프사이클 관리 |

## Skills

| Skill | 역할 |
|-------|------|
| package-validator | SAX 패키지 구조 검증 |
| version-manager | SAX 버저닝 자동화 |
| package-sync | 패키지 소스 → .claude 동기화 |
| package-deploy | 외부 프로젝트 SAX 배포 |

## Dependencies

- **sax-core**: 필수 (../sax-core 참조)

## References

- [SAX Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [SAX Core](https://github.com/semicolon-devteam/sax-core)
