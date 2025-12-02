---
name: help
description: SAX 도움말 - sax-help skill 호출 (공통)
---

# /SAX:help Command

SAX 사용법, 패키지 정보, Semicolon 팀 컨텍스트에 대한 질문에 응답합니다.

> **공통 커맨드**: 모든 SAX 패키지에서 사용 가능

## Trigger

- `/SAX:help` 명령어
- "SAX 도움말", "SAX란", "SAX 사용법" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **SAX 사용법 질문**: SAX 기능, 명령어, 워크플로우 안내
2. **패키지 정보 조회**: 설치된 패키지 버전, Agent/Skill 목록
3. **팀 컨텍스트 질문**: Semicolon 팀 규칙, docs 레포 정보

## Action

`/SAX:help` 실행 시 `sax-core/skill:sax-help`을 호출합니다.

```markdown
[SAX] Skill: sax-help 호출

> sax-core/skills/sax-help 스킬을 호출합니다.
```

## Workflow

### Step 1: 질문 분석

사용자 질문의 카테고리를 파악합니다:

| 카테고리 | 예시 질문 |
|----------|-----------|
| SAX 기본 | "SAX란?", "SAX 어떻게 사용해?" |
| 패키지 정보 | "설치된 패키지 뭐야?", "버전 확인" |
| 명령어 안내 | "/SAX:* 명령어 뭐있어?" |
| 팀 컨텍스트 | "Semicolon 팀 규칙", "docs 위키" |

### Step 2: 정보 조회

**참조 소스**:

| 소스 | 내용 |
|------|------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 |
| `sax-core/TEAM_RULES.md` | Semicolon 팀 규칙 |
| `.claude/sax-*/VERSION` | 설치된 패키지 버전 |
| `docs` 레포 Wiki | 팀 문서, 가이드 |

### Step 3: 응답 제공

```markdown
[SAX] Skill: sax-help 응답

## {질문 카테고리}

{관련 정보 및 안내}

---
📚 상세 정보: [관련 문서 링크]
```

## Expected Output

### SAX 소개 질문

```markdown
[SAX] Skill: sax-help 응답

## SAX (Semicolon Agent eXperience)

SAX는 Semicolon 팀의 Claude Code 확장 프레임워크입니다.

### 핵심 기능
- **Agent**: 복잡한 워크플로우 자동화
- **Skill**: 재사용 가능한 기능 모듈
- **Command**: 빠른 실행을 위한 슬래시 명령어

### 공통 명령어
| 명령어 | 설명 |
|--------|------|
| `/SAX:help` | 도움말 (현재) |
| `/SAX:slack` | Slack 메시지 전송 |
| `/SAX:update` | SAX 업데이트 |
| `/SAX:feedback` | 피드백 제출 |

---
📚 상세 정보: sax-core/PRINCIPLES.md
```

### 패키지 정보 질문

```markdown
[SAX] Skill: sax-help 응답

## 설치된 SAX 패키지

| 패키지 | 버전 | 설명 |
|--------|------|------|
| sax-core | 0.10.0 | 공통 컴포넌트 |
| sax-meta | 0.35.0 | SAX 패키지 관리 |

### 사용 가능한 Agent/Skill
- Agents: orchestrator, sax-architect, ...
- Skills: notify-slack, version-updater, ...

---
📚 상세 정보: 각 패키지 CLAUDE.md 참조
```

## Related

- [sax-help Skill](../../skills/sax-help/SKILL.md)
- [SAX Core - Principles](../../PRINCIPLES.md)
- [SAX Core - Team Rules](../../TEAM_RULES.md)
