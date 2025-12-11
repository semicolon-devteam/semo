---
name: project-board
description: GitHub Project 보드 이슈 연동 및 상태 관리. Use when (1) 이슈 생성 후 프로젝트 보드 연동, (2) 태스크 완료 후 상태 변경, (3) Fast-track/정석 프로세스 완료 시 리뷰요청 상태 설정, (4) 사용자가 직접 상태 변경 요청.
tools: [Bash, GitHub CLI]
triggers:
  - 프로젝트 보드 연동
  - 상태 변경
  - 리뷰요청으로 변경
  - 작업중으로 변경
  - 테스트중으로 변경
  - 상태로 만들어줘
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: project-board 호출 - {action}` 시스템 메시지를 첫 줄에 출력하세요.

# Project Board Skill

> GitHub Project 보드에 이슈 추가 및 상태 관리 자동화

## Purpose

이슈의 GitHub Projects 상태를 관리합니다:

1. **자동 추가**: 이슈가 프로젝트에 없으면 기본 프로젝트(`이슈관리` #1)에 자동 추가
2. **상태 변경**: Projects 보드의 **Status 필드**를 변경 (Labels 아님!)
3. **날짜 속성 자동 설정**: 상태 변경 시 관련 날짜 속성 자동 설정

## 날짜 속성 자동화 규칙

| 상태 변경 | 설정 속성 | 값 |
|----------|----------|-----|
| → **작업중** | `시작일` | 오늘 날짜 |
| → **리뷰요청** | `종료일` | 오늘 날짜 |
| → **테스트중** | `Assignee 추가` | @kokkh (QA 담당자) |

> **🔴 CRITICAL**: 상태 변경 시 해당 날짜 속성도 반드시 함께 설정해야 합니다.
>
> **🔴 CRITICAL**: 상태 변경 시 **Labels가 아닌 Projects Status 필드**를 변경해야 합니다.

## 상수 (Constants)

> **⚠️ 조직 프로젝트 정보는 변경될 수 있으므로 API로 확인**

```yaml
organization: semicolon-devteam
project_number: 1  # "이슈관리" 프로젝트
status_field_name: Status
```

## Core Functions

### 1. 이슈를 프로젝트 보드에 추가

```bash
# 이슈 URL로 프로젝트에 추가
gh project item-add 1 --owner semicolon-devteam --url "${ISSUE_URL}"
```

### 2. 프로젝트 정보 조회

```bash
# Project ID 및 Status 필드 정보 조회
gh api graphql -f query='
query($org: String!, $projectNumber: Int!) {
  organization(login: $org) {
    projectV2(number: $projectNumber) {
      id
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options {
            id
            name
          }
        }
      }
    }
  }
}' -f org="semicolon-devteam" -F projectNumber=1
```

### 3. 이슈의 Item ID 조회

```bash
# 이슈가 연결된 Project Item 조회
gh api graphql -f query='
query($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      projectItems(first: 10) {
        nodes {
          id
          project {
            title
            number
          }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              optionId
            }
          }
        }
      }
    }
  }
}' -f owner="semicolon-devteam" -f repo="${REPO}" -F issueNumber="${ISSUE_NUM}"
```

### 4. 상태 변경

```bash
# Status 값 업데이트
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
    projectV2Item {
      id
    }
  }
}' -f projectId="${PROJECT_ID}" -f itemId="${ITEM_ID}" -f fieldId="${FIELD_ID}" -f optionId="${OPTION_ID}"
```

### 5. 테스터 Assignee 추가 (테스트중 상태 시)

> **🔴 CRITICAL**: 테스트중 상태로 변경 시 반드시 QA 담당자(@kokkh)를 Assignee로 추가합니다.

```bash
# 이슈에 QA 담당자 할당
gh issue edit ${ISSUE_NUM} --repo semicolon-devteam/${REPO} --add-assignee kokkh
```

## 핵심 워크플로우: 상태 변경 요청 처리

> **🔴 중요**: 사용자가 "리뷰요청 상태로 만들어줘" 등 요청 시 이 워크플로우를 따릅니다.

### Step 1: 이슈 → 프로젝트 연결 확인

```bash
# 이슈가 프로젝트에 연결되어 있는지 확인
ITEMS=$(gh api graphql -f query='...' | jq '.data.repository.issue.projectItems.nodes | length')

if [ "$ITEMS" -eq 0 ]; then
  # 프로젝트에 추가
  gh project item-add 1 --owner semicolon-devteam --url "${ISSUE_URL}"
fi
```

### Step 2: Status 필드 변경 (Labels 아님!)

```bash
# Status 필드 업데이트 (GraphQL mutation)
gh api graphql -f query='mutation {...}' ...
```

### Step 3: 결과 출력

```markdown
[SAX] Skill: project-board 완료

📋 **이슈**: {repo}#{issue_number}
📊 **프로젝트**: 이슈관리 (#1)
🔄 **상태 변경**: {이전 상태} → **{새 상태}**

✅ Projects 보드 상태 변경 완료
```

---

## Workflow: 이슈 생성 후 리뷰요청 설정

Fast-track 또는 정석 프로세스 완료 시 사용:

```markdown
[SAX] Skill: project-board 호출 - 이슈 연동 및 상태 설정

📋 **대상 이슈**: {repo}#{issue_number}

### Step 1: 프로젝트 보드에 추가
```bash
gh project item-add 1 --owner semicolon-devteam --url "https://github.com/semicolon-devteam/{repo}/issues/{issue_number}"
```

### Step 2: 프로젝트 정보 조회
{PROJECT_ID, FIELD_ID, OPTION_ID 조회}

### Step 3: 상태를 "리뷰요청"으로 변경
{mutation 실행}

✅ **완료**: {repo}#{issue_number} → 리뷰요청
```

## 상태 전환 규칙

| 시나리오 | 변경 후 상태 | 추가 동작 |
|----------|-------------|----------|
| Fast-track 완료 | **리뷰요청** | 종료일 설정 |
| Speckit 구현 완료 | **리뷰요청** | 종료일 설정 |
| PR 머지 완료 | **테스트중** | **@kokkh Assignee 추가** |
| QA 테스트 통과 | **병합됨** | - |

## 호출 패턴

### Fast-track에서 호출

```markdown
# fast-track Step 3 완료 후
skill: project-board({
  repo: "cm-land",
  issue_number: 123,
  target_status: "리뷰요청"
})
```

### Review-task에서 호출

```markdown
# 리뷰 완료 + PR 머지 후
skill: project-board({
  repo: "cm-land",
  issue_number: 456,
  target_status: "테스트중"
})
# → 자동으로 @kokkh Assignee 추가
```

### Task-progress에서 호출

```markdown
# 작업 시작 시
skill: project-board({
  repo: "cm-office",
  issue_number: 32,
  target_status: "작업중"
})
```

## Output Format

### 성공

```markdown
[SAX] Skill: project-board 완료

📋 **이슈**: {repo}#{issue_number}
📊 **프로젝트**: 이슈관리 (#1)
🔄 **상태 변경**: {이전 상태} → **{새 상태}**
👤 **Assignee**: @kokkh 추가 (테스트중 상태인 경우)

✅ 프로젝트 보드 연동 완료
```

### 실패 - 프로젝트 미연결

```markdown
[SAX] Skill: project-board 경고

⚠️ 이슈가 프로젝트에 연결되어 있지 않습니다.

📋 **이슈**: {repo}#{issue_number}

**자동 추가 시도 중...**
{gh project item-add 실행}

✅ 프로젝트에 추가 완료 → 상태 설정 진행
```

### 실패 - 권한 오류

```markdown
[SAX] Skill: project-board 실패

❌ Project 상태 변경 권한이 없습니다.

**Project**: 이슈관리
**필요 권한**: write

Organization admin에게 권한을 요청하세요.
```

## 에러 처리

| 에러 | 원인 | 해결 |
|------|------|------|
| `Could not resolve to a Project` | 프로젝트 번호 오류 | 프로젝트 번호 확인 |
| `Resource not accessible` | 권한 부족 | 조직 권한 확인 |
| `Field not found` | Status 필드 없음 | 프로젝트 설정 확인 |
| `Option not found` | 상태값 없음 | 상태 목록 조회 후 재시도 |

## Integration Points

이 Skill을 호출하는 곳:

| Skill | 호출 시점 | 설정 상태 |
|-------|----------|----------|
| `fast-track` | Step 3 이슈 생성 후 | 리뷰요청 |
| `review-task` | Phase 6 PR 머지 후 | 테스트중 |
| `task-progress` | 작업 시작 시 | 작업중 |
| `git-workflow` | PR 머지 완료 시 | 테스트중 |

## References

- [Project Status](../git-workflow/references/project-status.md) - 상세 API 가이드
- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
