# Message Format

> SAX 메시지 출력 포맷

## Agent 위임 시

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {target_agent} (사유: {reason})
```

## Skill 호출 시

> **🔴 중요**: Skill 호출 시 **Agent 위임이 아닌 Skill 호출**임을 명시합니다.

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Skill 호출: {skill_name}

/
```

### 호출 방법

Routing Table에서 `skill:{skill_name}` 형식으로 지정된 경우:

1. Orchestrator가 의도 분석 메시지 출력
2. `[SAX] Skill 호출: {skill_name}` 메시지 출력
3. `/` (슬래시) 출력으로 메시지 블록 종료
4. 해당 Skill의 SKILL.md를 참조하여 Skill 로직 실행
5. Skill 내부 시스템 메시지 출력

### 예시 (feedback Skill 호출)

```markdown
User: SAX가 왜 이렇게 동작해?

[SAX] Orchestrator: 의도 분석 완료 → SAX 동작 오류 지적

[SAX] Skill 호출: feedback

/

[SAX] Skill: feedback 호출 - 버그 리포트
...
```

## 라우팅 실패 시

```markdown
[SAX] Orchestrator: 라우팅 실패 → 적절한 Agent 없음
```
