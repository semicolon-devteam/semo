# SEMO-Core

> SEMO (Semicolon AI Transformation) 프레임워크의 핵심 원칙과 규칙

## Overview

SEMO-Core는 모든 SEMO 패키지가 상속하는 공통 원칙과 규칙을 정의합니다.

## Installation

### As Git Submodule (권장)

```bash
git submodule add https://github.com/semicolon-devteam/semo-core.git .claude/semo-core
```

### Manual Copy

```bash
cp -r semo-core/ your-project/.claude/semo-core/
```

## Structure

```text
semo-core/
├── PRINCIPLES.md      # SEMO 핵심 원칙
├── MESSAGE_RULES.md   # SEMO 메시지 포맷 규칙
├── PACKAGING.md       # SEMO 패키지 구조 가이드
├── TEAM_RULES.md      # Semicolon 팀 규칙
└── README.md          # 이 파일
```

## Contents

### PRINCIPLES.md

- 투명성, 일관성, 모듈성, 계층성 원칙
- Orchestrator-First Policy
- Agent/Skill 원칙
- 버전 관리 규칙

### MESSAGE_RULES.md

- SEMO 메시지 포맷: `[SEMO] {Type}: {name} {action}`
- 메시지 유형: Orchestrator, Agent, Skill, Reference
- 출력 규칙 및 예시

### PACKAGING.md

- SEMO 패키지 구조 표준
- CLAUDE.md 작성 가이드
- 배포 및 버저닝 가이드

### TEAM_RULES.md

- Semicolon 팀 협업 규칙
- 응답 언어, 커밋 컨벤션 등

## Usage in Packages

각 SEMO 패키지의 CLAUDE.md에서 다음과 같이 참조:

```markdown
## SEMO Core 상속

이 패키지는 SEMO Core의 기본 원칙을 상속합니다.

@semo-core/PRINCIPLES.md
@semo-core/MESSAGE_RULES.md
```

## Version

현재 버전은 SEMO 전체 버전을 따릅니다.

## References

- [SEMO Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [Semicolon Team Docs](https://github.com/semicolon-devteam/docs)
