---
name: report-test-result
description: |
  테스트 결과 보고 및 상태 변경. Use when:
  (1) 테스트 통과/실패 처리, (2) GitHub Project 상태 변경,
  (3) 이슈 코멘트 작성, (4) Slack 알림 전송.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: report-test-result 호출 - {repo}#{number} {result}` 시스템 메시지를 첫 줄에 출력하세요.

# Report Test Result Skill

> 테스트 결과 보고 및 후속 처리

## 트리거

- `/SEMO:test-pass {repo}#{number}` - 테스트 통과
- `/SEMO:test-fail {repo}#{number} 사유: {reason}` - 테스트 실패
- "통과", "Pass", "성공" + 이슈 참조
- "실패", "Fail", "버그" + 이슈 참조

## Pass 처리 워크플로우

1. **상태 변경**: "테스트중" → "병합됨"
2. **이슈 코멘트**: 테스트 통과 기록
3. **Slack 알림**: 프로덕션 배포 가능 알림

### Pass 처리 쿼리

```bash
# 1. Project Item ID 조회
ITEM_ID=$(gh api graphql -f query='...' --jq '...')

# 2. 상태 변경: 테스트중 → 병합됨
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item { id }
  }
}'

# 3. 이슈 코멘트
gh issue comment {number} --repo semicolon-devteam/{repo} --body "✅ **QA 테스트 통과**

테스트 결과: **PASS**
테스트 일시: $(date)
테스터: @{tester}

프로덕션 배포 가능합니다."
```

### Pass 출력

```markdown
[SEMO] Skill: report-test-result 호출 - {repo}#{number} PASS

## ✅ 테스트 통과 처리 완료

**이슈**: {repo}#{number}
**결과**: PASS
**상태 변경**: 테스트중 → **병합됨**

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] 이슈 코멘트 작성
- [x] Slack 알림 전송 (#_협업)

### 다음 단계

🚀 프로덕션 배포가 가능합니다.
```

## Fail 처리 워크플로우

1. **상태 변경**: "테스트중" → "수정요청"
2. **이슈 코멘트**: 실패 사유 기록
3. **Slack 알림**: 담당 개발자에게 알림
4. **이터레이션 카운트**: +1

### Fail 처리 쿼리

```bash
# 1. 상태 변경: 테스트중 → 수정요청
# (위와 동일한 mutation, optionId만 다름)

# 2. 이슈 코멘트
gh issue comment {number} --repo semicolon-devteam/{repo} --body "❌ **QA 테스트 실패**

테스트 결과: **FAIL**
테스트 일시: $(date)
테스터: @{tester}
Iteration: #{iteration_count}

### 실패 사유

{failure_reason}

### 재현 방법

{reproduction_steps}

수정 후 다시 테스트 요청해주세요."
```

### Fail 출력

```markdown
[SEMO] Skill: report-test-result 호출 - {repo}#{number} FAIL

## ❌ 테스트 실패 처리 완료

**이슈**: {repo}#{number}
**결과**: FAIL
**상태 변경**: 테스트중 → **수정요청**
**Iteration**: #{iteration_count}

### 실패 사유

{failure_reason}

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] 이슈 코멘트 작성
- [x] 담당자 Slack 알림 (@{assignee})
- [x] 이터레이션 카운트 증가

### 다음 단계

개발자가 수정 후 다시 "테스트중" 상태로 변경하면 재테스트합니다.
```

## Slack 알림

### Pass 알림

```
✅ QA 테스트 통과

이슈: {repo}#{number} - {title}
프로덕션 배포가 가능합니다! 🚀
```

### Fail 알림

```
❌ QA 테스트 실패

이슈: {repo}#{number} - {title}
담당자: @{assignee}
사유: {failure_reason}

수정 후 재테스트 요청해주세요.
```

## 🔴 용어 변환 가이드 (비개발자 친화적 표현)

> **⚠️ 테스트 결과 코멘트 및 Slack 알림 작성 시 개발 용어 대신 일반 용어를 사용합니다.**

| 개발 용어 | 일반 용어 | 예시 |
|----------|----------|------|
| CRUD | 작성/조회/수정/삭제 | "CRUD 불가" → "작성/수정/삭제 기능 동작 안함" |
| 404 에러 | 페이지를 찾을 수 없음 | "404 에러 발생" → "페이지를 찾을 수 없음" |
| 500 에러 | 서버 오류 | "500 에러" → "서버 오류 발생" |
| API | 서버 연동 | "API 호출 실패" → "서버 연동 실패" |
| 리다이렉트 | 다른 페이지로 이동 | "리다이렉트 안됨" → "다른 페이지로 이동 안됨" |
| enum 에러 | 선택 값 오류 | "enum 에러" → "선택 값 오류" |
| validation | 입력 값 검증 | "validation 실패" → "입력 값 검증 실패" |
| timeout | 응답 시간 초과 | "timeout 발생" → "응답 시간 초과" |
| null/undefined | 값 없음 | "null 반환" → "값이 표시되지 않음" |
| Pass/Fail | 정상/실패 | "Pass" → "정상", "Fail" → "실패" |
| Critical | 심각 | "Critical" → "심각" |
| Major | 중요 | "Major" → "중요" |
| Minor | 경미 | "Minor" → "경미" |

### 이슈 코멘트 변환 예시

```markdown
# Before (개발 용어)
❌ **QA 테스트 실패**

테스트 결과: **FAIL**
실패 사유: `invalid input value for enum permission_type` 에러, 404 에러

# After (일반 용어)
❌ **QA 테스트 실패**

테스트 결과: **실패**
실패 사유: 권한 선택 값 오류 발생, 페이지를 찾을 수 없음
```

---

## GitHub Project 상태 조회

> **SoT**: 상태 옵션은 GitHub Project에서 직접 조회

```bash
gh api graphql -f query='query { organization(login: "semicolon-devteam") { projectV2(number: 1) { field(name: "Status") { ... on ProjectV2SingleSelectField { options { id name } } } } } }' --jq '.data.organization.projectV2.field.options[]'
```

## References

- [Pass Workflow](references/pass-workflow.md)
- [Fail Workflow](references/fail-workflow.md)
- [Comment Templates](references/comment-templates.md)

## Related

- [qa-master Agent](../../agents/qa-master/qa-master.md)
- [iteration-tracker Skill](../iteration-tracker/SKILL.md)
- [notify-slack Skill](../../../semo-core/skills/notify-slack/SKILL.md)
