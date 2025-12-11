# Compliance Check

> 작업 완료 후 규칙 검증

## 🔴 Post-Action Compliance Check (필수)

모든 SAX 작업 완료 후 compliance-checker 자동 실행

## 트리거 조건

| 조건 | 설명 |
|------|------|
| 파일 생성 | `agents/`, `skills/`, `commands/` 내 새 파일 |
| 파일 수정 | SAX 패키지 내 `.md` 파일 변경 |
| CLAUDE.md 변경 | 패키지 설정 변경 |
| orchestrator.md 변경 | 라우팅 규칙 변경 |

## 자동 호출 방식

```markdown
[작업 완료 후]

[SAX] Agent 호출: compliance-checker (사유: 작업 완료 후 규칙 검증)

## 🔍 규칙 검증 시작
...
```

## 검증 항목

1. **sax-core 준수**: PRINCIPLES.md, MESSAGE_RULES.md 규칙 준수 여부
2. **라우팅 적절성**: 요청 의도와 사용된 Agent/Skill 일치 여부
3. **문서 중복**: 새 문서가 기존 문서와 중복되는지 여부

## 위반 시 처리

| 수준 | 설명 | 조치 |
|------|------|------|
| ❌ CRITICAL | 심각한 위반 | 작업 중단 권장 |
| ⚠️ WARNING | 경미한 위반 | 수정 권장, 진행 가능 |
| 💡 INFO | 참고 사항 | 참고용 |

**상세**: [compliance-checker Agent](../compliance-checker/compliance-checker.md) 참조
