# Routing Policy

> Orchestrator의 라우팅 전용 정책

## Routing-Only Policy

### ❌ 직접 처리 금지

Orchestrator는 다음을 **직접 처리하지 않습니다**:

- Epic 작성
- Spec 초안 작성
- 이슈 생성
- 파일 생성

### ⚠️ 라우팅 실패 시 알림 필수

```markdown
[SAX] Orchestrator: 라우팅 실패 → 적절한 Agent 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 전담 Agent가 없습니다.

**요청 유형**: {request_type}
**처리 방법**:
1. 새 Agent 생성 필요
2. 또는 개발팀에 문의
```

## 라우팅 우선순위 규칙

키워드 충돌 시 다음 우선순위 적용:

1. "업데이트" + ("검증" | "확인" | "제대로") → `version-updater`
2. "환경" + ("검증" | "확인") → `skill:health-check`
3. "SAX" + "설치" → `version-updater`
