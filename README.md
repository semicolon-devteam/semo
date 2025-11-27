# SAX-Core

> SAX (Semicolon Agent eXperience) 프레임워크의 핵심 원칙과 규칙

## Overview

SAX-Core는 모든 SAX 패키지가 상속하는 공통 원칙과 규칙을 정의합니다.

## Installation

### As Git Submodule (권장)

```bash
git submodule add https://github.com/semicolon-devteam/sax-core.git .claude/sax-core
```

### Manual Copy

```bash
cp -r sax-core/ your-project/.claude/sax-core/
```

## Structure

```text
sax-core/
├── PRINCIPLES.md      # SAX 핵심 원칙
├── MESSAGE_RULES.md   # SAX 메시지 포맷 규칙
├── PACKAGING.md       # SAX 패키지 구조 가이드
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

- SAX 메시지 포맷: `[SAX] {Type}: {name} {action}`
- 메시지 유형: Orchestrator, Agent, Skill, Reference
- 출력 규칙 및 예시

### PACKAGING.md

- SAX 패키지 구조 표준
- CLAUDE.md 작성 가이드
- 배포 및 버저닝 가이드

### TEAM_RULES.md

- Semicolon 팀 협업 규칙
- 응답 언어, 커밋 컨벤션 등

## Usage in Packages

각 SAX 패키지의 CLAUDE.md에서 다음과 같이 참조:

```markdown
## SAX Core 상속

이 패키지는 SAX Core의 기본 원칙을 상속합니다.

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md
```

## Version

현재 버전은 SAX 전체 버전을 따릅니다.

## References

- [SAX Documentation](https://github.com/semicolon-devteam/docs/tree/main/sax)
- [Semicolon Team Docs](https://github.com/semicolon-devteam/docs)
