---
name: test-fail
description: 테스트 실패 처리
---

# /SAX:test-fail Command

테스트 실패 처리 및 수정 요청.

## Trigger

- `/SAX:test-fail {repo}#{number} 사유: {reason}` 명령어
- "실패", "Fail" + 이슈 참조

## Syntax

```
/SAX:test-fail {repo}#{number} 사유: {failure_reason}
```

**예시**:

- `/SAX:test-fail cm-office#45 사유: 댓글 작성 버튼이 클릭되지 않음`
- `/SAX:test-fail core-backend#88 사유: API 500 에러 발생`

## Action

`skill:report-test-result`를 실행하여:

1. GitHub Project 상태 변경: 테스트중 → 수정요청
2. 이슈 코멘트 작성 (실패 사유 기록)
3. Slack 알림 전송 (담당 개발자에게 알림)
4. 이터레이션 카운트 증가

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 테스트 결과 보고

[SAX] Skill: report-test-result 호출 - cm-office#45 FAIL

## ❌ 테스트 실패 처리 완료

**이슈**: cm-office#45
**결과**: FAIL
**상태 변경**: 테스트중 → **수정요청**
**Iteration**: #2

### 실패 사유

댓글 작성 버튼이 클릭되지 않음

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] 이슈 코멘트 작성
- [x] 담당자 Slack 알림 (@developer1)
- [x] 이터레이션 카운트 증가

### 다음 단계

개발자가 수정 후 다시 "테스트중" 상태로 변경하면 재테스트합니다.
```

## Related

- [report-test-result Skill](../../skills/report-test-result/SKILL.md)
- [test-pass Command](./test-pass.md)
- [iteration-tracker Skill](../../skills/iteration-tracker/SKILL.md)
