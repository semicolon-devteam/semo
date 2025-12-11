---
name: help
description: SEMO 도움말 - semo-help skill 호출 (공통)
---

# /SEMO:help Command

SEMO 사용법, 패키지 정보, Semicolon 팀 컨텍스트에 대한 질문에 응답합니다.

> **공통 커맨드**: 모든 SEMO 프로젝트에서 사용 가능

## Trigger

- `/SEMO:help` 명령어
- "SEMO 도움말", "SEMO란", "SEMO 사용법" 키워드

## Purpose

이 명령어는 다음 상황에서 사용됩니다:

1. **SEMO 사용법 질문**: SEMO 기능, 명령어, 워크플로우 안내
2. **구조 정보 조회**: 설치된 semo-system 버전, Skill 목록
3. **팀 컨텍스트 질문**: Semicolon 팀 규칙, docs 정보

## Action

`/SEMO:help` 실행 시 도움말 정보를 제공합니다.

```markdown
[SEMO] Command: help 실행

> SEMO 사용법을 안내합니다.
```

## Workflow

### Step 1: 질문 분석

사용자 질문의 카테고리를 파악합니다:

| 카테고리 | 예시 질문 |
|----------|-----------|
| SEMO 기본 | "SEMO란?", "SEMO 어떻게 사용해?" |
| 구조 정보 | "설치된 스킬 뭐야?", "버전 확인" |
| 명령어 안내 | "/SEMO:* 명령어 뭐있어?" |
| 팀 컨텍스트 | "Semicolon 팀 규칙" |

### Step 2: 정보 조회

**참조 소스**:

| 소스 | 내용 |
|------|------|
| `semo-system/semo-core/principles/` | SEMO 핵심 원칙 |
| `.claude/memory/` | 프로젝트 컨텍스트 |
| `semo-system/semo-skills/` | 사용 가능한 스킬 목록 |

### Step 3: 응답 제공

```markdown
[SEMO] Command: help 응답

## {질문 카테고리}

{관련 정보 및 안내}
```

## Expected Output

### SEMO 소개 질문

```markdown
[SEMO] Command: help 응답

## SEMO (Semicolon Orchestrate)

SEMO는 AI 에이전트 오케스트레이션 프레임워크입니다.

### 핵심 구조
- **semo-core**: Layer 0 - 원칙, 오케스트레이션
- **semo-skills**: Layer 1 - 기능별 스킬 (coder, tester, planner)
- **semo-integrations**: Layer 2 - 외부 연동 (MCP)

### 공통 명령어
| 명령어 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 (현재) |
| `/SEMO:slack` | Slack 메시지 전송 |
| `/SEMO:health` | 환경 검증 |
| `/SEMO:feedback` | 피드백 제출 |
| `/SEMO:update` | SEMO 업데이트 |
```

## Related

- [SEMO Principles](../../principles/PRINCIPLES.md)
- [SEMO Skills](../../semo-skills/)
