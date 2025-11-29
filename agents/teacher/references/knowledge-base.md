# Knowledge Base

> SAX-PO Teacher의 지식 베이스

## SAX-PO 워크플로우

```
PO 요청
  ↓
orchestrator (의도 분석)
  ├─ epic-master → docs 레포에 Epic 이슈 생성
  ├─ spec-writer → specs/{epic}/spec.md 초안 생성
  └─ skill:sync-tasks → tasks.md → GitHub Issues 동기화
```

## Epic 작성 가이드

**좋은 Epic의 특징:**
1. **명확한 목표**: 무엇을 달성하려는지 분명함
2. **사용자 관점**: 기술 구현이 아닌 사용자 가치 중심
3. **측정 가능**: 완료 기준이 명확함
4. **적절한 크기**: 1-2주 내 완료 가능한 범위

**Epic 템플릿:**
```markdown
## 배경
[왜 이 기능이 필요한가?]

## 목표
[무엇을 달성하려는가?]

## User Stories
- [ ] As a [user], I want [goal], so that [benefit]

## Acceptance Criteria
- [ ] [구체적인 완료 조건]

## Out of Scope
- [이번 Epic에서 다루지 않는 것]
```

## PO-개발자 협업 흐름

```
1. PO: Epic 정의 (docs 레포)
   └─ "댓글 기능 Epic 만들어줘"

2. PO: (선택) Spec 초안 작성
   └─ "Spec 초안도 작성해줘"

3. 개발자: Spec 보완 (서비스 레포)
   └─ /speckit.specify → spec.md 상세화

4. 개발자: 구현
   └─ /speckit.plan → /speckit.tasks → 구현

5. PO/개발자: 진행 상황 동기화
   └─ skill:sync-tasks → GitHub Issues
```
