---
name: close-sprint
description: |
  Sprint(Iteration) 종료 및 회고 정리. Use when (1) Sprint 마감,
  (2) 회고 작성, (3) /SEMO:sprint close 커맨드.
tools: [Bash, Read, Write]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: close-sprint 호출` 메시지를 첫 줄에 출력하세요.

# close-sprint Skill

> Sprint(Iteration) 종료 처리 및 회고 생성

## Purpose

Sprint를 종료하고 회고를 정리하며, 미완료 Task를 다음 Iteration으로 이관합니다.

> **Note**: GitHub Projects Iteration은 기간이 지나면 자동으로 "완료됨"으로 이동합니다. 이 Skill은 Sprint 종료 시점의 통계를 정리하고 회고를 기록합니다.

## Workflow

```
Sprint 종료 요청
    ↓
1. Iteration의 완료/미완료 Task 집계
2. Velocity 계산 (완료된 작업량 합계)
3. 회고 요약 생성
4. Sprint Issue에 회고 추가
5. 미완료 Task → 다음 Iteration 이관
6. sprint-current 라벨 제거
    ↓
완료
```

## Input

```yaml
iteration_title: "11월 4/4"           # 필수
next_iteration: "12월 1/4"            # 선택 (미완료 이관용)
retrospective:                        # 선택
  good:
    - "API 개발 순조로움"
  improve:
    - "테스트 커버리지 부족"
```

## Output

```markdown
[SEMO] Skill: close-sprint 완료

✅ Sprint "11월 4/4" 종료 완료

**완료**: 8/10 Task (80%)
**Velocity**: 24pt
**미완료 이관**: 2 Task → 12월 1/4
```

## API 호출

### Iteration의 모든 Task 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
              state
              repository {
                name
              }
              assignees(first: 3) {
                nodes {
                  login
                }
              }
            }
          }
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
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
        }
      }
    }
  }
}'
```

### 완료/미완료 집계

```bash
# 위 쿼리 결과에서 필터링
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.fieldValueByName.title == "11월 4/4"))
  | {
      total: length,
      done: [.[] | select(.content.state == "CLOSED")] | length,
      open: [.[] | select(.content.state == "OPEN")] | length,
      velocity: [.[] | select(.content.state == "CLOSED") | .fieldValueByName.number // 0] | add
    }
'
```

### 미완료 Task → 다음 Iteration 이관

```bash
# 1. 미완료 Task의 Item ID 조회
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              state
            }
          }
          fieldValueByName(name: "이터레이션") {
            ... on ProjectV2ItemFieldIterationValue {
              title
            }
          }
        }
      }
    }
  }
}' | jq '[.data.organization.projectV2.items.nodes[] | select(.fieldValueByName.title == "11월 4/4" and .content.state == "OPEN") | .id]'

# 2. 다음 Iteration으로 이관 (각 Item에 대해)
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
  -f iterationId="{next_iteration_id}"
```

### Sprint Issue에 회고 추가

```bash
# Sprint Issue 찾기
SPRINT_ISSUE=$(gh issue list \
  --repo semicolon-devteam/docs \
  --label "sprint-current" \
  --search "Sprint: 11월 4/4" \
  --json number \
  | jq -r '.[0].number')

# 회고 코멘트 추가
gh issue comment $SPRINT_ISSUE \
  --repo semicolon-devteam/docs \
  --body "$(cat <<'EOF'
## 📝 Sprint 회고

### ✅ 잘된 점
- API 개발 순조로움
- 팀 협업 원활

### 🔧 개선할 점
- 테스트 커버리지 부족
- 코드 리뷰 지연

### 📊 통계
| 항목 | 값 |
|------|-----|
| 완료 Task | 8/10 (80%) |
| Velocity | 24pt |
| 미완료 이관 | 2 Task → 12월 1/4 |
EOF
)"

# 라벨 변경
gh issue edit $SPRINT_ISSUE \
  --repo semicolon-devteam/docs \
  --remove-label "sprint-current" \
  --add-label "sprint-closed"
```

## 회고 템플릿

```markdown
## 📝 Sprint 회고

### ✅ 잘된 점
{good_points}

### 🔧 개선할 점
{improve_points}

### 📊 통계
| 항목 | 값 |
|------|-----|
| 완료 Task | {done_count}/{total_count} ({completion_rate}%) |
| Velocity | {velocity}pt |
| 미완료 이관 | {carry_over_count} Task → {next_iteration} |

### 📈 Velocity 트렌드
| Iteration | Velocity | 완료율 |
|-----------|----------|--------|
| {prev_iteration_2} | {prev_velocity_2}pt | {prev_rate_2}% |
| {prev_iteration_1} | {prev_velocity_1}pt | {prev_rate_1}% |
| {current_iteration} | {velocity}pt | {completion_rate}% |
```

## Velocity 트렌드 조회

```bash
# 최근 완료된 Iteration들의 Velocity
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "이터레이션") {
        ... on ProjectV2IterationField {
          configuration {
            completedIterations {
              id
              title
              startDate
            }
          }
        }
      }
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              state
            }
          }
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
}'
```

## 완료 메시지

```markdown
[SEMO] Skill: close-sprint 완료

✅ **Sprint "{iteration_title}"** 종료 완료

## 📊 Sprint 결과

| 항목 | 값 |
|------|-----|
| 완료 Task | {done_count}/{total_count} ({completion_rate}%) |
| Velocity | {velocity}pt |
| 미완료 이관 | {carry_over_count} Task → {next_iteration} |

## 📈 Velocity 트렌드
| Iteration | Velocity |
|-----------|----------|
| {iteration_title} | {velocity}pt |
| 최근 4주 평균 | {avg_velocity}pt |

다음 Sprint "{next_iteration}"이 시작되었습니다.
```
