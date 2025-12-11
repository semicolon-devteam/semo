---
name: to-testing
description: |
  이슈를 테스트중 상태로 변경하고 QA 담당자를 자동 할당합니다.
argument: "{repo}#{number}"
---

# /SAX:to-testing Command

이슈를 "테스트중" 상태로 변경하고 QA 담당자(@kokkh)를 자동 할당합니다.

## 사용법

```bash
/SAX:to-testing {repo}#{number}
```

## 예시

```bash
/SAX:to-testing cm-office#45
/SAX:to-testing core-backend#22
```

## 처리 내용

1. GitHub Project 상태 변경: 현재 상태 → 테스트중
2. QA 담당자 자동 할당: @kokkh 추가 (기존 담당자 유지)
3. 이슈 코멘트: 테스트 요청 안내
4. Slack 알림: QA에게 테스트 요청 알림

## 출력 예시

```markdown
[SAX] Skill: change-to-testing 호출 - cm-office#45

## 🧪 테스트중 상태 변경 완료

**이슈**: cm-office#45
**제목**: 댓글 기능 추가
**상태 변경**: 리뷰요청 → **테스트중**
**QA 할당**: @kokkh ✅

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] QA 담당자 자동 할당 (@kokkh)
- [x] 이슈 코멘트 작성
- [x] Slack 알림 전송 (#_협업)

### 다음 단계

QA(@kokkh)가 테스트를 진행할 예정입니다.
```

## Related

- [change-to-testing Skill](../../skills/change-to-testing/SKILL.md)
- [test-queue Command](./test-queue.md)
