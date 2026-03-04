---
name: test-cases
description: |
  테스트 케이스 작성 및 관리. Use when:
  (1) 테스트 케이스 설계, (2) 시나리오 작성, (3) QA 체크리스트.
tools: [Read, Write]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: test-cases 호출` 시스템 메시지를 첫 줄에 출력하세요.

# test-cases Skill

> 테스트 케이스 작성 및 관리

## Test Case Types

| Type | 설명 | 대상 |
|------|------|------|
| **functional** | 기능 테스트 | API, UI |
| **edge** | 경계값 테스트 | 입력 검증 |
| **negative** | 부정 테스트 | 에러 처리 |
| **performance** | 성능 테스트 | 응답 시간 |

---

## Test Case 템플릿

```markdown
# Test Cases: {기능명}

## TC-001: {테스트 케이스명}

**목적**: {무엇을 테스트하는가}
**우선순위**: P0 | P1 | P2

### Preconditions
- {사전 조건1}
- {사전 조건2}

### Steps
1. {단계1}
2. {단계2}
3. {단계3}

### Expected Result
- {기대 결과}

### Actual Result
- {실제 결과}

### Status
- [ ] Pass
- [ ] Fail
- [ ] Blocked

### Notes
{추가 메모}
```

---

## QA 체크리스트 템플릿

```markdown
# QA 체크리스트 - {기능명}

## 기능 테스트
- [ ] 정상 플로우 동작 확인
- [ ] 에러 케이스 처리 확인
- [ ] 경계값 테스트

## UI/UX
- [ ] 반응형 레이아웃
- [ ] 로딩 상태 표시
- [ ] 에러 메시지 표시

## 성능
- [ ] API 응답 시간 < 1s
- [ ] 페이지 로드 < 3s

## 보안
- [ ] 인증/인가 확인
- [ ] XSS 방지
- [ ] CSRF 방지

## 호환성
- [ ] Chrome
- [ ] Safari
- [ ] Mobile
```

---

## 출력

```markdown
[SEMO] Skill: test-cases 완료

✅ 테스트 케이스 작성 완료

**파일**: docs/test-cases/user-login.md
**케이스 개수**: 12
**우선순위**: P0(3), P1(7), P2(2)
```

---

## Related

- `test` - 테스트 실행
- `request-test` - QA 테스트 요청
- `bug` - 버그 관리
