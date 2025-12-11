# SAX Core Rules

> sax-architect가 준수해야 하는 SAX Core 규칙

## MESSAGE_RULES.md

### 메시지 포맷

```markdown
[SAX] {Type}: {name} {action}
```

### 필수 규칙

- ✅ `[SAX]` 접두사 필수
- ✅ 각 메시지 별도 줄 출력
- ✅ 메시지 간 빈 줄 삽입
- ✅ 메시지 종료자: `/`

### 메시지 타입

| Type | 용도 |
|------|------|
| Orchestrator | 라우팅 결정 |
| Agent | Agent 호출/완료 |
| Skill | Skill 사용 |
| Reference | 외부 참조 |

## Orchestrator-First Policy

### 원칙

- ✅ SAX 메타 작업도 Orchestrator 먼저 거침
- ✅ 직접 Agent/Skill 호출 금지
- ✅ Orchestrator 메시지 생략 금지

### 메시지 순서

```markdown
[SAX] Orchestrator: 의도 분석 완료 → SAX 메타 작업 ({카테고리})

[SAX] Agent: sax-architect 역할 수행 (트리거: "Semicolon AX" 키워드)
```

## Single Source of Truth

- SAX Core 문서가 최종 권위
- 중복 정의 금지
- 항상 sax-core/ 참조
