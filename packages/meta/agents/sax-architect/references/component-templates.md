# Component Templates

> Agent 및 Skill 파일 생성 템플릿

## Agent 파일 구조

```markdown
---
name: {agent-name}
description: |
  {역할 요약}. PROACTIVELY use when:
  (1) {조건1}, (2) {조건2}, (3) {조건3}.
tools:
  - read_file
  - write_file
model: sonnet
---

> **🔔 시스템 메시지**: 이 Agent가 호출되면 `[SAX] Agent: {agent-name} 호출 - {context}` 시스템 메시지를 첫 줄에 출력하세요.

# {Agent Name} Agent

{상세 설명}

## 역할

1. {역할1}
2. {역할2}

## 트리거

- {키워드1}
- {키워드2}

## SAX 메시지

```markdown
[SAX] Agent: {agent-name} 호출 (트리거: {trigger})
```

## 워크플로우

### Phase 1: {단계명}

{단계 설명}
```

## Skill 파일 구조

```markdown
# {skill-name} Skill

> {한 줄 설명}

## Purpose

{Skill의 목적}

## Triggers

- {트리거1}
- {트리거2}

## Process

1. {단계1}
2. {단계2}

## Output Format

```json
{
  "result": "value"
}
```

## SAX Message

```markdown
[SAX] Skill: {skill-name} 사용
```

## Related

- [{관련 Agent}](../../agents/{agent}.md)
```
