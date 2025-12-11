---
name: generate-progress-report
description: |
  Sprint(Iteration) 진행도 리포트 생성. Use when (1) 진행 현황 조회,
  (2) /SEMO:progress 커맨드, (3) 상태 리포트 요청.
tools: [Bash, Read, Write]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: generate-progress-report 호출` 메시지를 첫 줄에 출력하세요.

# generate-progress-report Skill

> Sprint(Iteration) 진행도 리포트 생성

## Purpose

현재 Iteration(Sprint)의 진행 상황을 분석하고 리포트를 생성합니다.

## Workflow

```
진행도 리포트 요청
    ↓
1. 현재 Iteration 식별
2. Task 상태별 집계
3. 담당자별 현황 집계
4. 진행률 계산
5. 리포트 생성
    ↓
완료
```

## Input

```yaml
iteration_title: "12월 1/4"       # 선택 (기본: 현재 Iteration)
format: "markdown"                # 선택 (markdown|slack)
```

## Output

```markdown
# 📊 Sprint 12월 1/4 진행 현황

**기간**: 2025-12-01 ~ 2025-12-07
**진행률**: ████████░░ 78%

## 📈 상태별 현황
| 상태 | 개수 | 작업량 |
|------|------|--------|
| ✅ 완료 | 7 | 21pt |
| 🔄 작업중 | 3 | 9pt |
| ⏳ 대기 | 2 | 6pt |

## 👥 담당자별 현황
| 담당자 | 완료 | 작업중 | 대기 | 완료율 |
|--------|------|--------|------|--------|
| @kyago | 3 | 1 | 0 | 75% |
| @Garden | 2 | 1 | 1 | 50% |

## ⏱️ 일정 현황
- **남은 기간**: D-3
- **예상 완료율**: 90%
```

## API 호출

### 현재 Iteration 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "이터레이션") {
        ... on ProjectV2IterationField {
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
}' | jq '.data.organization.projectV2.field.configuration.iterations[0]'
```

### Iteration Task 전체 조회

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
          iteration: fieldValueByName(name: "이터레이션") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              startDate
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          workload: fieldValueByName(name: "작업량") {
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

### 상태별 집계

```bash
# 위 쿼리 결과에서 현재 Iteration 필터링 후 상태별 집계
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | group_by(.status.name)
  | map({
      status: .[0].status.name,
      count: length,
      workload: ([.[].workload.number // 0] | add)
    })
'
```

### 담당자별 집계

```bash
# Iteration 필터링 후 담당자별 집계
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(. as $item | .content.assignees.nodes[] | {assignee: .login, status: $item.status.name, workload: $item.workload.number})
  | group_by(.assignee)
  | map({
      assignee: .[0].assignee,
      done: [.[] | select(.status == "병합됨" or .status == "검수완료")] | length,
      in_progress: [.[] | select(.status == "작업중" or .status == "리뷰요청")] | length,
      todo: [.[] | select(.status == "검수대기")] | length
    })
'
```

## Progress Bar 생성

```javascript
function generateProgressBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
}

// 78% → ████████░░ 78%
```

## 상태 매핑 (Semicolon Projects)

| Projects 상태 | 분류 | 아이콘 |
|--------------|------|--------|
| 검수대기 | 대기 | ⏳ |
| 작업중 | 작업중 | 🔄 |
| 확인요청 | 작업중 | 🔄 |
| 수정요청 | 작업중 | 🔄 |
| 리뷰요청 | 작업중 | 👀 |
| 테스트중 | 작업중 | 🧪 |
| 검수완료 | 완료 | ✅ |
| 병합됨 | 완료 | ✅ |
| 버려짐 | 취소 | ❌ |

## 완료 메시지

```markdown
[SEMO] Skill: generate-progress-report 완료

# 📊 Sprint "{iteration_title}" 진행 현황

**기간**: {start_date} ~ {end_date}
**진행률**: {progress_bar}

## 📈 상태별 현황
| 상태 | 개수 | 작업량 |
|------|------|--------|
| ✅ 완료 | {done_count} | {done_workload}pt |
| 🔄 작업중 | {progress_count} | {progress_workload}pt |
| ⏳ 대기 | {todo_count} | {todo_workload}pt |

## 👥 담당자별 현황
| 담당자 | 완료 | 작업중 | 대기 | 완료율 |
|--------|------|--------|------|--------|
{member_rows}

## ⏱️ 일정 현황
- **남은 기간**: D-{days_remaining}
- **예상 완료율**: {estimated_completion}%

{blockers_warning}
```
