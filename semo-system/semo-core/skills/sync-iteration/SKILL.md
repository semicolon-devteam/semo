---
name: sync-iteration
description: |
  미완료 이슈들의 Iteration을 현재(Current)로 일괄 동기화. Use when (1) iteration 업데이트/갱신 요청,
  (2) 이터레이션 동기화, (3) /SEMO:sprint sync 커맨드.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: sync-iteration 호출` 메시지를 첫 줄에 출력하세요.

# sync-iteration Skill

> 미완료 이슈들의 Iteration을 현재(Current)로 일괄 동기화

## Purpose

GitHub Projects에서 OPEN 상태인 이슈들 중 Iteration이 현재가 아니거나 설정되지 않은 이슈들을 현재 Iteration으로 일괄 업데이트합니다.

## Workflow

```text
iteration 동기화 요청
    ↓
1. 현재(Current) Iteration 조회 (오늘 날짜 기준)
2. 모든 OPEN 상태 이슈 조회
3. iteration이 current가 아니거나 없는 이슈 필터링
4. --dry-run 시: 변경 예정 목록만 출력
5. 실행 시: 각 이슈의 iteration → current로 업데이트
6. 결과 리포트 출력
    ↓
완료
```

## Input

```yaml
dry_run: false  # true면 미리보기만, false면 실행
```

## Output

### 실행 모드

```markdown
[SEMO] Skill: sync-iteration 완료

✅ {count}개 이슈의 Iteration을 "{current_iteration}"로 업데이트했습니다.

| Repo | # | Title | 이전 Iteration | 상태 |
|------|---|-------|----------------|------|
{issue_rows}

**요약**: {count}개 이슈 처리 완료
```

### dry-run 모드

```markdown
[SEMO] Skill: sync-iteration 호출 (dry-run 모드)

📋 변경 예정 목록 - 현재 Iteration: "{current_iteration}"

| Repo | # | Title | 현재 Iteration | 변경 후 |
|------|---|-------|----------------|---------|
{issue_rows}

**요약**: {count}개 이슈가 업데이트될 예정입니다.

> 실행하려면 `/SEMO:sprint sync` (--dry-run 없이) 를 사용하세요.
```

## API 호출

### Step 1: Current Iteration 조회

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
}'
```

**Current Iteration 판별 로직**:

- 오늘 날짜 기준으로 `startDate ≤ today < startDate + duration`인 iteration이 "current"
- duration은 일(day) 단위

### Step 2: 모든 OPEN 이슈 조회 및 필터링

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              state
              repository {
                name
              }
            }
          }
          fieldValueByName(name: "이터레이션") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              iterationId
            }
          }
        }
      }
    }
  }
}'
```

**필터링 조건**:

```bash
# jq로 필터링
| jq '[.data.organization.projectV2.items.nodes[]
  | select(.content.state == "OPEN")
  | select(.fieldValueByName == null or .fieldValueByName.title != "{current_iteration_title}")]'
```

### Step 3: Iteration 필드 업데이트

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
  -f iterationId="{current_iteration_id}"
```

## 에러 처리

### 업데이트할 이슈가 없는 경우

```markdown
[SEMO] Skill: sync-iteration 완료

✅ 모든 OPEN 이슈가 이미 현재 Iteration("{current_iteration}")에 있습니다.

업데이트할 이슈가 없습니다.
```

### Current Iteration을 찾을 수 없는 경우

```markdown
[SEMO] Skill: sync-iteration 실패

❌ 현재 날짜에 해당하는 Iteration을 찾을 수 없습니다.

**확인 사항**:
- GitHub Projects에서 Iteration 설정 확인
- 오늘 날짜가 활성 Iteration 기간 내인지 확인
```

### 일부 업데이트 실패

```markdown
[SEMO] Skill: sync-iteration 완료 (일부 실패)

✅ {success_count}개 이슈 업데이트 완료
❌ {fail_count}개 이슈 업데이트 실패

| Repo | # | Title | 상태 | 비고 |
|------|---|-------|------|------|
{issue_rows}
```

## 트리거 키워드

- "iteration 업데이트"
- "이터레이션 업데이트"
- "iteration 동기화"
- "이터레이션 갱신"
- "iteration 갱신"

## Related

- `assign-to-sprint`: Task를 특정 Iteration에 할당
- `close-sprint`: Sprint 종료 및 미완료 Task 이관
- `start-task`: Task 시작 시 현재 Iteration 자동 할당
