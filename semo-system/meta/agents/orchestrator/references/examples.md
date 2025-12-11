# Routing Examples

> Orchestrator 라우팅 예시

## Agent 관리

### Agent 생성

```markdown
User: 새 Agent 만들어줘

[SEMO] Orchestrator: 의도 분석 완료 → Agent 생성 요청

[SEMO] Agent 위임: agent-manager (사유: SEMO Agent 생성)
```

### Agent 수정

```markdown
User: epic-master Agent 역할 확장해줘

[SEMO] Orchestrator: 의도 분석 완료 → Agent 수정 요청

[SEMO] Agent 위임: agent-manager (사유: SEMO Agent 수정)
```

### Agent 검토

```markdown
User: agent 검토해봐

[SEMO] Orchestrator: 의도 분석 완료 → Agent 분석 요청

[SEMO] Agent 위임: agent-manager (사유: SEMO Agent 품질 분석)
```

## Skill 관리

### Skill 생성

```markdown
User: 새 Skill 만들어줘

[SEMO] Orchestrator: 의도 분석 완료 → Skill 생성 요청

[SEMO] Agent 위임: skill-manager (사유: SEMO Skill 생성)
```

### Skill 삭제

```markdown
User: deprecated-skill 삭제해줘

[SEMO] Orchestrator: 의도 분석 완료 → Skill 삭제 요청

[SEMO] Agent 위임: skill-manager (사유: SEMO Skill 삭제)
```

### Skill 분석

```markdown
User: SEMO Skills 검토해줘. Anthropic 표준 준수하는지 확인해줘

[SEMO] Orchestrator: 의도 분석 완료 → Skill 분석 요청

[SEMO] Agent 위임: skill-manager (사유: SEMO Skill 품질 분석)
```

## Skill 호출

### 패키지 검증

```markdown
User: SEMO-PO 패키지 구조 검증해줘

[SEMO] Orchestrator: 의도 분석 완료 → 패키지 검증 요청

[SEMO] Skill 호출: package-validator
```

### 버전 관리

```markdown
User: SEMO v3.9.0 릴리스해줘

[SEMO] Orchestrator: 의도 분석 완료 → 버전 관리 요청

[SEMO] Skill 호출: version-manager
```

## 워크플로우 질문

```markdown
User: SEMO 개발은 어떻게 해?

[SEMO] Orchestrator: 의도 분석 완료 → 워크플로우 안내

## 📋 SEMO 개발 워크플로우

1. **Agent/Skill 생성**: 새 기능을 Agent 또는 Skill로 구현
2. **패키지 검증**: package-validator로 구조 확인
3. **버전 관리**: version-manager로 버저닝 및 CHANGELOG 작성
4. **동기화**: .claude/ 디렉토리에 동기화
```
