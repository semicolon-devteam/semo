---
name: request-test-cases
description: |
  테스트 케이스(AC) 보완 요청. Use when:
  (1) AC가 부족한 이슈 감지, (2) PO/개발자에게 보완 요청,
  (3) 이슈 코멘트 및 Slack 알림.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: request-test-cases 호출 - {repo}#{number}` 시스템 메시지를 첫 줄에 출력하세요.

# Request Test Cases Skill

> AC 보완 요청 및 알림

## 트리거

- `validate-test-cases` Skill에서 AC 부족 판정 후 호출
- "AC 요청", "테스트 케이스 요청" 키워드

## 요청 워크플로우

1. **이슈 상태 변경**: "테스트중" → "확인요청"
2. **이슈 코멘트 작성**: AC 보완 요청
3. **Slack 알림**: 담당자에게 통지
4. **대기**: 보완 완료 후 재확인

## 상태 변경

```bash
# 테스트중 → 확인요청
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
```

## 이슈 코멘트 템플릿

```markdown
## ⚠️ 테스트 케이스 보완 요청

현재 이슈의 Acceptance Criteria가 부족하여 테스트를 진행하기 어렵습니다.

### 현황

- **현재 AC**: {current_count}개
- **권장 AC**: 최소 3개

### 보완 필요 항목

다음 시나리오에 대한 AC 추가를 요청드립니다:

- [ ] 정상 동작 시나리오 (Happy path)
- [ ] 예외 처리 시나리오 (Error cases)
- [ ] Edge case 시나리오 (경계값, 특수 상황)

### 예시

```text
## Acceptance Criteria

- [ ] 사용자가 댓글을 작성하면 목록에 즉시 표시된다
- [ ] 빈 댓글 작성 시 "내용을 입력하세요" 에러가 표시된다
- [ ] 1000자 초과 입력 시 글자수 제한 안내가 표시된다
```

AC 보완 후 상태를 "테스트중"으로 변경해주세요.

---
> 🤖 SAX-QA 자동 생성 코멘트
```

## Slack 알림

```
⚠️ 테스트 케이스 보완 요청

이슈: {repo}#{number} - {title}
담당자: @{assignee}
현재 AC: {count}개 (최소 3개 필요)

AC 보완 후 "테스트중" 상태로 변경해주세요.
```

## 출력 형식

```markdown
[SAX] Skill: request-test-cases 호출 - {repo}#{number}

## ⚠️ AC 보완 요청 완료

**이슈**: {repo}#{number}
**상태 변경**: 테스트중 → **확인요청**

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] 이슈 코멘트 작성
- [x] Slack 알림 전송 (@{assignee})

### 대기

AC 보완 후 "테스트중" 상태로 변경되면 테스트를 재개합니다.
```

## GitHub Project 상태 조회

> **SoT**: 상태 옵션은 GitHub Project에서 직접 조회

```bash
gh api graphql -f query='query { organization(login: "semicolon-devteam") { projectV2(number: 1) { field(name: "Status") { ... on ProjectV2SingleSelectField { options { id name } } } } } }' --jq '.data.organization.projectV2.field.options[]'
```

## References

- [Comment Templates](references/comment-templates.md)
- [AC Examples](references/ac-examples.md)

## Related

- [validate-test-cases Skill](../validate-test-cases/SKILL.md)
- [qa-master Agent](../../agents/qa-master/qa-master.md)
