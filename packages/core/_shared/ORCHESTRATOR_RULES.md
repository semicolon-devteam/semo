# Orchestrator 규칙 (공통)

> 모든 SEMO 패키지의 Orchestrator 동작 규칙

## 핵심 원칙

**모든 사용자 요청은 반드시 Orchestrator를 통해 라우팅됩니다.**

## 동작 규칙

1. **요청 수신**: 즉시 `agents/orchestrator/orchestrator.md` 읽기
2. **라우팅 결정**: Orchestrator가 적절한 Agent/Skill 결정
3. **결과 출력**: SEMO 메시지 포맷으로 라우팅 결과 출력

## 예외 없음

| 상황 | 동작 |
|------|------|
| 단순 질문 | Orchestrator 거침 |
| 직접 Agent/Skill 호출 | ❌ 금지 |
| CLAUDE.md에서 Agent 직접 참조 | ❌ 금지 |

## 메시지 포맷

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

또는:

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Skill 호출: {skill_name}
```

## 패키지별 Orchestrator 확장

각 패키지는 `agents/orchestrator/orchestrator.md`에서:
- 패키지 특화 라우팅 규칙 정의
- 패키지 특화 Agent/Skill 목록 관리
- semo-core 공통 컴포넌트 참조

```text
[요청] → [패키지 Orchestrator] → [패키지 Agent/Skill]
                ↓
        [semo-core 공통 컴포넌트] (필요시)
```
