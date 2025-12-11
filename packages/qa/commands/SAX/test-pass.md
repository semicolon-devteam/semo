---
name: test-pass
description: 테스트 통과 처리
---

# /SAX:test-pass Command

테스트 통과 처리 및 상태 변경.

## Trigger

- `/SAX:test-pass {repo}#{number}` 명령어
- "통과", "Pass" + 이슈 참조

## Syntax

```
/SAX:test-pass {repo}#{number}
```

**예시**:

- `/SAX:test-pass cm-office#45`
- `/SAX:test-pass core-backend#88`

## Action

`skill:report-test-result`를 실행하여:

1. GitHub Project 상태 변경: 테스트중 → 병합됨
2. 이슈 코멘트 작성 (테스트 통과 기록)
3. Slack 알림 전송 (프로덕션 배포 가능 알림)

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 테스트 결과 보고

[SAX] Skill: report-test-result 호출 - cm-office#45 PASS

## ✅ 테스트 통과 처리 완료

**이슈**: cm-office#45
**결과**: PASS
**상태 변경**: 테스트중 → **병합됨**

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] 이슈 코멘트 작성
- [x] Slack 알림 전송 (#_협업)

### 다음 단계

🚀 프로덕션 배포가 가능합니다.
```

## Related

- [report-test-result Skill](../../skills/report-test-result/SKILL.md)
- [test-fail Command](./test-fail.md)
