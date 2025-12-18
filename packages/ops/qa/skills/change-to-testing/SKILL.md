---
name: change-to-testing
description: |
  이슈를 테스트중 상태로 변경 및 QA 자동 할당. Use when:
  (1) "테스트중으로 변경해줘" 요청, (2) 개발 완료 후 QA 전달,
  (3) 이슈 상태를 테스트중으로 바꿔야 할 때.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: change-to-testing 호출 - {repo}#{number}` 시스템 메시지를 첫 줄에 출력하세요.

# Change to Testing Skill

> 이슈를 "테스트중" 상태로 변경하고 QA 담당자를 자동 할당

## 트리거

- "테스트중으로 변경해줘", "테스트중으로 바꿔줘"
- "{repo}#{number} 테스트중으로"
- "QA에 넘겨줘", "테스트 요청해줘"

## 핵심 기능

1. **상태 변경**: 현재 상태 → "테스트중"
2. **QA 자동 할당**: @kokkh 자동 추가 (기존 담당자 유지)
3. **Slack 알림**: QA에게 테스트 요청 알림

## 워크플로우

### 1. Project Item ID 조회

```bash
ITEM_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!, $repo: String!, $issueNumber: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              number
              repository { name }
            }
          }
        }
      }
    }
  }
}' -f org="semicolon-devteam" -F number=1 -f repo="{repo}" -F issueNumber={issueNumber} \
--jq '.data.organization.projectV2.items.nodes[] | select(.content.number == {issueNumber} and .content.repository.name == "{repo}") | .id')
```

### 2. Status Field 및 Option ID 조회

```bash
# Status 필드 ID 조회
FIELD_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
        }
      }
    }
  }
}' -f org="semicolon-devteam" -F number=1 --jq '.data.organization.projectV2.field.id')

# "테스트중" 옵션 ID 조회
OPTION_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          options { id name }
        }
      }
    }
  }
}' -f org="semicolon-devteam" -F number=1 --jq '.data.organization.projectV2.field.options[] | select(.name == "테스트중") | .id')
```

### 3. 상태 변경

```bash
# Project ID 조회
PROJECT_ID=$(gh api graphql -f query='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) { id }
  }
}' -f org="semicolon-devteam" -F number=1 --jq '.data.organization.projectV2.id')

# 상태 변경 실행
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
}' -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$FIELD_ID" -f optionId="$OPTION_ID"
```

### 4. QA 담당자 자동 할당

```bash
# @kokkh를 이슈 담당자에 추가 (기존 담당자 유지)
gh issue edit {number} --repo semicolon-devteam/{repo} --add-assignee kokkh
```

### 5. 이슈 코멘트 작성

```bash
gh issue comment {number} --repo semicolon-devteam/{repo} --body "🧪 **테스트 요청됨**

상태가 **테스트중**으로 변경되었습니다.
QA 담당자: @kokkh

---
*SEMO에서 자동 처리됨*"
```

### 6. Slack 알림

> **📖 프로젝트별 채널 매핑**: `.claude/memory/projects.md`의 "프로젝트 맵" 섹션 참조

**채널 결정 로직**:
1. `.claude/memory/projects.md`에서 레포지토리 → Slack 채널 매핑 조회
2. 매핑이 있으면 해당 채널로 발송
3. 매핑이 없으면 `#_협업`으로 fallback

**채널 매핑 예시**:
| 레포지토리 | Slack 채널 |
|-----------|------------|
| cm-land | #cm-land |
| cm-office | #cm-office |
| core-backend | #backend |
| (기타) | #_협업 |

```text
🧪 QA 테스트 요청

이슈: {repo}#{number} - {title}
담당자: @kokkh
요청자: @{developer}

테스트 대기열에 추가되었습니다.
```

## 출력 형식

```markdown
[SEMO] Skill: change-to-testing 호출 - {repo}#{number}

## 🧪 테스트중 상태 변경 완료

**이슈**: {repo}#{number}
**제목**: {title}
**상태 변경**: {이전_상태} → **테스트중**
**QA 할당**: @kokkh ✅

### 처리 내역

- [x] GitHub Project 상태 변경
- [x] QA 담당자 자동 할당 (@kokkh)
- [x] 이슈 코멘트 작성
- [x] Slack 알림 전송 ({프로젝트_채널})

### 다음 단계

QA(@kokkh)가 테스트를 진행할 예정입니다.
테스트 결과는 Pass/Fail로 보고됩니다.
```

## QA 담당자 설정

> **기본 QA 담당자**: @kokkh

### 향후 확장 가능

```yaml
qa_assignees:
  default: kokkh
  # 추후 레포지토리별 QA 담당자 설정 가능
  # cm-office: kokkh
  # core-backend: other-qa
```

## 에러 처리

### 이슈를 찾을 수 없음

```markdown
[SEMO] Skill: change-to-testing 호출 - {repo}#{number}

❌ **오류**: 이슈를 찾을 수 없습니다.

- 레포지토리: {repo}
- 이슈 번호: #{number}

이슈 번호와 레포지토리를 확인해주세요.
```

### 이미 테스트중 상태

```markdown
[SEMO] Skill: change-to-testing 호출 - {repo}#{number}

ℹ️ **알림**: 이미 "테스트중" 상태입니다.

- 현재 상태: 테스트중
- QA 담당자: @kokkh (이미 할당됨)

추가 작업이 필요하지 않습니다.
```

## References

- [GitHub Projects GraphQL](references/gh-projects-graphql.md)
- [QA Assignee Config](references/qa-assignee-config.md)

## Related

- [test-queue Skill](../test-queue/SKILL.md) - 테스트 대기열 확인
- [report-test-result Skill](../report-test-result/SKILL.md) - 테스트 결과 보고
- [qa-master Agent](../../agents/qa-master/qa-master.md) - QA 통합 관리
