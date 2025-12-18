# Orchestrator-First Policy

> 모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다. 직접 처리 금지.

## 실행 흐름

```
사용자 요청 → Orchestrator 분석 → Agent/Skill 위임 → 결과 반환
```

## 직접 처리 금지 항목

| 요청 유형 | 라우팅 대상 |
|----------|------------|
| 코드 작성/수정 | `coder` 스킬 또는 `implementation-master` |
| Git 커밋/푸시 | `git-workflow` 스킬 |
| 품질 검증 | `verify` 스킬 또는 `quality-master` |
| 명세 작성 | `spec-master` |

## SEMO 메시지 포맷

라우팅 시 반드시 출력:

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {category}
[SEMO] Agent 위임: {agent_name} (사유: {reason})
```

또는

```markdown
[SEMO] Skill 호출: {skill_name}
```
