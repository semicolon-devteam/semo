---
name: assign-to-sprint
description: |
  Task를 Sprint(Iteration)에 할당. Use when (1) Sprint 계획 시 Task 선정,
  (2) Task 추가 할당, (3) /SEMO:sprint add 커맨드.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: assign-to-sprint 호출` 메시지를 첫 줄에 출력하세요.

# assign-to-sprint Skill

> Task를 Sprint(Iteration)에 할당하고 작업량 설정

## Purpose

GitHub Projects의 Iteration 필드를 통해 Task를 Sprint에 할당합니다.

## Workflow

```
Task 할당 요청
    ↓
1. 대상 Task(Issue) 확인
2. Projects에서 Item ID 조회
3. Iteration 필드 값 설정
4. 작업량(Point) 설정 (선택)
5. 용량 체크
    ↓
완료
```

## Input

```yaml
iteration_title: "12월 1/4"           # 필수
tasks:                                # 필수
  - repo: "command-center"
    number: 123
    workload: 3                       # 선택 (작업량 필드)
  - repo: "cm-land"
    number: 456
    workload: 5
```

## Output

```markdown
[SEMO] Skill: assign-to-sprint 완료

✅ 2개 Task를 "12월 1/4"에 할당했습니다.

| Repo | # | Task | 작업량 | 담당자 |
|------|---|------|--------|--------|
| command-center | #123 | 댓글 API | 3 | @kyago |
| cm-land | #456 | 알림 연동 | 5 | @Garden |

**Sprint 용량**: 8pt 할당
```

## API 호출

### Issue의 Project Item ID 조회

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
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

### Iteration 필드 ID 및 Option ID 조회

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
            }
          }
        }
      }
    }
  }
}'
```

### Iteration 필드 값 설정

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
    projectV2Item {
      id
    }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="PVTIF_lADOC01-Rc4AtDz2zgj4d7g" \
  -f iterationId="{iteration_id}"
```

### 작업량(Point) 설정

```bash
# 작업량 필드 ID 조회
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "작업량") {
        ... on ProjectV2Field {
          id
        }
      }
    }
  }
}'

# 작업량 값 설정
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $value }
    }
  ) {
    projectV2Item {
      id
    }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="{workload_field_id}" \
  -F value=3
```

### Issue가 Project에 없는 경우 추가

```bash
gh api graphql -f query='
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(
    input: {
      projectId: $projectId
      contentId: $contentId
    }
  ) {
    item {
      id
    }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f contentId="{issue_node_id}"
```

## 용량 체크

### 현재 Sprint 할당량 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          fieldValueByName(name: "이터레이션") {
            ... on ProjectV2ItemFieldIterationValue {
              title
            }
          }
          fieldValueByName(name: "작업량") {
            ... on ProjectV2ItemFieldNumberValue {
              number
            }
          }
        }
      }
    }
  }
}' | jq '[.data.organization.projectV2.items.nodes[] | select(.fieldValueByName.title == "12월 1/4") | .fieldValueByName.number // 0] | add'
```

### 용량 경고

#### 정상 (80% 미만)

```markdown
✅ Task 할당 완료

**Sprint 용량**: 28pt (팀 용량 대비 적정)
```

#### 주의 (80-100%)

```markdown
⚠️ Task 할당 완료

**Sprint 용량**: 38pt - 주의

Sprint 용량이 많습니다. 추가 할당 시 주의하세요.
```

#### 위험 (100% 이상)

```markdown
🚨 용량 초과 경고

현재 Sprint 할당량: 45pt

**권장 조치**:
1. 우선순위 낮은 Task 다음 Sprint로 이관
2. Task 분할 검토
```

## 완료 메시지

```markdown
[SEMO] Skill: assign-to-sprint 완료

✅ {count}개 Task를 "{iteration_title}"에 할당했습니다.

| Repo | # | Task | 작업량 | 담당자 |
|------|---|------|--------|--------|
{task_rows}

**Sprint 총 작업량**: {total_workload}pt
```
