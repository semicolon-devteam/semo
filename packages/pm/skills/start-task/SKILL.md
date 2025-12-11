---
name: start-task
description: |
  Task 작업 시작 처리. Use when (1) Task 상태를 '작업중'으로 변경,
  (2) 시작일 자동 설정, (3) 현재 이터레이션 자동 할당, (4) /SEMO:sprint start 커맨드.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: start-task 호출` 메시지를 첫 줄에 출력하세요.

# start-task Skill

> Task 작업 시작 시 상태, 시작일, 이터레이션을 한 번에 설정

## Purpose

Task 작업을 시작할 때 필요한 모든 Projects 필드를 자동으로 설정합니다.

| 자동 설정 항목 | 설명 |
|---------------|------|
| **상태** | '작업중'으로 변경 |
| **시작일** | 오늘 날짜로 설정 |
| **이터레이션** | 현재(Current) 이터레이션으로 할당 |

## Workflow

```text
작업 시작 요청
    ↓
1. 대상 Task(Issue) 확인
2. Projects Item ID 조회
3. 현재 이터레이션 조회
4. 3개 필드 일괄 업데이트
   - 상태 → 작업중
   - 시작일 → 오늘
   - 이터레이션 → Current
    ↓
완료
```

## Input

### 단일 Task

```yaml
repo: "command-center"
number: 123
```

### 복수 Task

```yaml
tasks:
  - repo: "command-center"
    number: 123
  - repo: "cm-land"
    number: 456
```

### 옵션

```yaml
iteration: "12월 1/4"    # 선택: 특정 이터레이션 지정 (기본: current)
skip_iteration: false    # 선택: 이터레이션 설정 생략
```

## Output

### 성공

```markdown
[SEMO] Skill: start-task 완료

✅ 2개 Task 작업 시작 처리 완료

| Repo | # | Task | 상태 | 시작일 | 이터레이션 |
|------|---|------|------|--------|-----------|
| command-center | #123 | 댓글 API | 작업중 | 2025-12-01 | 12월 1/4 |
| cm-land | #456 | 알림 연동 | 작업중 | 2025-12-01 | 12월 1/4 |
```

### 이미 작업중인 Task

```markdown
⚠️ #123은 이미 '작업중' 상태입니다.

시작일/이터레이션만 업데이트하시겠습니까?
- 시작일: 2025-11-28 → 2025-12-01
- 이터레이션: 11월 4/4 → 12월 1/4
```

## API 호출

### 1. Issue의 Projects Item ID 조회

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      title
      assignees(first: 1) {
        nodes { login }
      }
      projectItems(first: 10) {
        nodes {
          id
          project {
            number
            title
          }
        }
      }
    }
  }
}' -f owner="semicolon-devteam" -f repo="command-center" -F number=123
```

### 2. 현재 이터레이션 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      field(name: "이터레이션") {
        ... on ProjectV2IterationField {
          id
          configuration {
            iterations {
              id
              title
              startDate
              duration
            }
          }
        }
      }
    }
  }
}' | jq '
  .data.organization.projectV2.field.configuration.iterations
  | map(select(
      (.startDate | strptime("%Y-%m-%d") | mktime) <= now
      and
      ((.startDate | strptime("%Y-%m-%d") | mktime) + (.duration * 86400)) > now
    ))
  | .[0]
'
```

### 3. 필드 ID 조회 (상태, 시작일)

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
          ... on ProjectV2Field {
            id
            name
            dataType
          }
        }
      }
    }
  }
}'
```

### 4. 상태 변경 (작업중)

```bash
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
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="{status_field_id}" \
  -f optionId="{in_progress_option_id}"
```

### 5. 시작일 설정

```bash
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { date: $value }
    }
  ) {
    projectV2Item { id }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="{start_date_field_id}" \
  -f value="2025-12-01"
```

### 6. 이터레이션 설정

```bash
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { iterationId: $iterationId }
    }
  ) {
    projectV2Item { id }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="{iteration_field_id}" \
  -f iterationId="{current_iteration_id}"
```

## 현재 이터레이션 판단 로직

```javascript
function getCurrentIteration(iterations) {
  const now = new Date();

  return iterations.find(iter => {
    const start = new Date(iter.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + iter.duration);

    return now >= start && now < end;
  });
}
```

## 에러 처리

### Projects에 연결되지 않은 Issue

```markdown
⚠️ #123이 이슈관리 프로젝트에 연결되어 있지 않습니다.

자동으로 프로젝트에 추가 후 작업을 시작합니다...

✅ 완료: #123을 이슈관리 프로젝트에 추가하고 작업을 시작했습니다.
```

### 현재 이터레이션이 없는 경우

```markdown
⚠️ 현재 활성화된 이터레이션이 없습니다.

**권장 조치**:
1. GitHub Projects에서 새 이터레이션 생성
2. 또는 `--skip-iteration` 옵션으로 이터레이션 없이 시작

상태와 시작일만 설정하시겠습니까? (y/n)
```

### 시작일 필드가 없는 경우

```markdown
⚠️ Projects에 '시작일' 필드가 없습니다.

**권장 조치**:
GitHub Projects 설정에서 'Date' 타입의 '시작일' 필드를 추가하세요.

상태와 이터레이션만 설정합니다...
```

## 연관 워크플로우

### 작업 시작 전체 흐름

```text
1. set-estimate (작업량 설정)
2. assign-to-sprint (Sprint 할당) - 선택적
3. start-task (작업 시작)  ← THIS
   - 상태 → 작업중
   - 시작일 → 오늘
   - 이터레이션 → Current
4. 작업 진행...
5. close-sprint (Sprint 종료)
```

### Sprint 계획 없이 바로 시작하는 경우

```text
1. set-estimate (작업량 설정) - 선택적
2. start-task (작업 시작)
   - 자동으로 현재 이터레이션 할당
   - 시작일 오늘로 설정
```

## 완료 메시지

```markdown
[SEMO] Skill: start-task 완료

✅ {count}개 Task 작업 시작 처리 완료

| Repo | # | Task | 상태 | 시작일 | 이터레이션 |
|------|---|------|------|--------|-----------|
{task_rows}

**현재 이터레이션**: {current_iteration}
```

## Related

- [assign-to-sprint](../assign-to-sprint/SKILL.md) - Sprint 사전 할당
- [set-estimate](../set-estimate/SKILL.md) - 작업량 설정
- [sync-project-status](../sync-project-status/SKILL.md) - 상태 동기화
- [detect-blockers](../detect-blockers/SKILL.md) - 블로커 감지 (시작일 기반)
