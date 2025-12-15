# SEMO-PM Message Format

> SEMO Core MESSAGE_RULES.md 준수

## 필수 메시지 형식

### Orchestrator 분석

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {의도 카테고리}
```

**의도 카테고리**:
- Sprint 계획
- Sprint 관리
- 진행도 조회
- 리포트 생성
- Roadmap 관리

---

### Agent 위임

```markdown
[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

**예시**:
```markdown
[SEMO] Agent 위임: sprint-master (사유: Sprint 생성 요청)
[SEMO] Agent 위임: progress-tracker (사유: 주간 리포트 생성)
[SEMO] Agent 위임: roadmap-planner (사유: Roadmap 시각화)
```

---

### Skill 호출

```markdown
[SEMO] Skill: {skill_name} 호출
```

**예시**:
```markdown
[SEMO] Skill: create-sprint 호출
[SEMO] Skill: generate-progress-report 호출
```

---

### Skill 완료

```markdown
[SEMO] Skill: {skill_name} 완료
```

---

### Reference 참조

```markdown
[SEMO] Reference: {reference_path} 참조
```

---

## 전체 흐름 예시

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → Sprint 계획

[SEMO] Agent 위임: sprint-master (사유: Sprint 생성 요청)

## Sprint 계획을 시작합니다

[SEMO] Skill: create-sprint 호출

Sprint 23을 생성했습니다.

[SEMO] Skill: create-sprint 완료

[SEMO] Skill: notify-slack 호출 - Sprint 생성 알림
```
