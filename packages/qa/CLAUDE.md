<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SEMO - Semicolon AI Transformation)

# SEMO-QA Package Configuration

> QA 테스터를 위한 SEMO 패키지

## Package Info

- **Package**: SEMO-QA
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: STG 환경에서 테스트 수행
- **Audience**: QA 담당자, 테스터

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [_shared/INIT_SETUP.md](../_shared/INIT_SETUP.md)

새 세션 시작 시 자동 실행 (4-Phase):
```text
버전 체크 → 구조 검증 → 동기화 검증 → 메모리 복원
```

### 2. SEMO Core 참조

> 📖 상세: [_shared/SEMO_CORE_REFERENCE.md](../_shared/SEMO_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [_shared/ORCHESTRATOR_RULES.md](../_shared/ORCHESTRATOR_RULES.md)

모든 요청 → `agents/orchestrator.md` → Agent/Skill 라우팅

---

## QA Workflow

### 테스트 프로세스

```text
1. 테스트 대기 이슈 확인 (테스트중 상태)
2. 테스트 항목 확인 (AC 기반)
3. STG 환경 검증
4. 테스트 실행 및 결과 기록
5. Pass/Fail 처리 및 상태 변경
```

### GitHub Project 상태 흐름

```text
리뷰요청 → [dev 머지] → 테스트중 → [QA Pass] → 병합됨
                            ↓
                       [QA Fail] → 수정요청
```

### Iteration 관리

| 항목 | 설명 |
|------|------|
| 1 Iteration | dev 머지 → STG 테스트 → Pass/Fail 판정 |
| Fail 시 | 수정요청 상태 + 이슈 코멘트 + Slack 알림 |
| Pass 조건 | 1 Iteration 내 모든 AC 항목 통과 |

---

## PO/개발자 연동

### PO (SEMO-PO)
1. Epic 생성 → 테스트 기준 정의
2. Draft Task 생성 → AC(Acceptance Criteria) 포함

### 개발자 (SEMO-Next)
1. 구현 완료 → PR 생성 → dev 머지
2. 이슈 상태가 "테스트중"으로 자동 변경

### QA (SEMO-QA)
1. "테스트중" 상태 이슈 대기열 확인
2. AC 기반 테스트 수행
3. Pass → "병합됨" 상태 변경
4. Fail → "수정요청" 상태 변경 + 개발자 알림

---

## Test Case 요청

AC 미비 이슈 감지 시:

```markdown
[SEMO] Skill: request-test-cases

⚠️ 테스트 케이스 보완 요청

이슈: #{issue_number}
현재 AC: {count}개 / 권장: 최소 3개

보완 필요 항목:
- [ ] 정상 동작 시나리오
- [ ] 예외 처리 시나리오
- [ ] Edge case 시나리오
```

---

## References

- [SEMO Core - Principles](https://github.com/semicolon-devteam/semo-core/blob/main/PRINCIPLES.md)
- [SEMO Core - Message Rules](https://github.com/semicolon-devteam/semo-core/blob/main/MESSAGE_RULES.md)
