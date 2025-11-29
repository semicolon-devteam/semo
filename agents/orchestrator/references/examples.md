# Examples

> SAX-PO Orchestrator 라우팅 예시

## 예시 1: Epic 생성 요청

```markdown
User: 댓글 기능 Epic 만들어줘

[SAX] Orchestrator: 의도 분석 완료 → Epic 생성 요청

[SAX] Agent 위임: epic-master (사유: 새 도메인 Epic 생성)
```

## 예시 2: Epic 이식 요청

```markdown
User: command-center에 있는 CONTACT Epic을 docs로 이식해줘

[SAX] Orchestrator: 의도 분석 완료 → Epic 이식 요청

[SAX] Agent 위임: epic-master (사유: 레포지토리 간 Epic 마이그레이션)
```

## 예시 3: Spec 초안 요청

```markdown
User: 방금 만든 Epic으로 Spec 초안 작성해줘

[SAX] Orchestrator: 의도 분석 완료 → Spec 초안 요청

[SAX] Agent 위임: spec-writer (사유: Epic 기반 Spec 초안 생성)
```

## 예시 4: 워크플로우 질문

```markdown
User: PO로서 뭐부터 해야해?

[SAX] Orchestrator: 의도 분석 완료 → 워크플로우 안내

## 📋 PO 워크플로우

1. **Epic 정의**: 새 기능의 요구사항을 Epic으로 정리
2. **Spec 초안**: (선택) 개발자에게 전달할 Spec 초안 작성
3. **개발팀 전달**: 개발자가 speckit으로 상세 명세 작성
4. **진행도 추적**: GitHub Projects에서 모니터링
```

## 예시 5: Skill 호출

```markdown
User: SAX가 왜 이렇게 동작해?

[SAX] Orchestrator: 의도 분석 완료 → SAX 동작 오류 지적

[SAX] Skill 호출: feedback

/

[SAX] Skill: feedback 호출 - 버그 리포트
...
```
