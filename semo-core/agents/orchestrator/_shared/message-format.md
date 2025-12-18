# SEMO Message Format

> 모든 Orchestrator가 사용하는 표준 메시지 포맷

## 라우팅 메시지

### Agent 위임

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {category}

[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

**예시:**
```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현

[SEMO] Agent 위임: implementation-master (사유: 명세 기반 구현 요청)
```

### Skill 호출

```markdown
[SEMO] Skill 호출: {skill_name}
```

**예시:**
```markdown
[SEMO] Skill 호출: notify-slack
```

### 라우팅 실패

```markdown
[SEMO] 라우팅 실패: {reason}

{guidance}
```

## 작업 완료 메시지

### Skill 완료

```markdown
[SEMO] Skill: {skill_name} 완료
```

### Agent 완료

```markdown
[SEMO] Agent: {agent_name} 작업 완료

{summary}
```

## 접두사 감지 메시지

패키지 접두사 감지 시:

```markdown
[SEMO] 접두사 감지: [{prefix}] → {package_name}

[SEMO] {package_name} Orchestrator로 위임
```
