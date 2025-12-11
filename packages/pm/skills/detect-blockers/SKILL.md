---
name: detect-blockers
description: |
  블로커 및 지연 Task 감지. Use when (1) 블로커 확인,
  (2) 지연 현황 조회, (3) 자동 모니터링.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: detect-blockers 호출` 메시지를 첫 줄에 출력하세요.

# detect-blockers Skill

> 블로커 및 지연 Task 감지

## Purpose

프로젝트 진행을 방해하는 블로커와 지연된 Task를 자동으로 감지합니다.

## Workflow

```
블로커 감지 요청
    ↓
1. 작업중 장기 Task 감지 (3일+)
2. blocked 라벨 Task 조회
3. 의존성 미해결 Task 확인
4. 심각도 분류
5. 알림 (Critical 시)
    ↓
완료
```

## Input

```yaml
iteration_title: "12월 1/4"       # 선택 (기본: 현재 Iteration)
threshold_days: 3                 # 선택 (지연 판정 기준, 기본 3일)
notify: true                      # 선택 (Slack 알림 여부)
```

## Output

```markdown
# 🚨 블로커 현황

**기준일**: 2025-12-05
**Iteration**: 12월 1/4

## 🔴 Critical (즉시 조치 필요)

| Repo | # | Task | 담당자 | 지연 | 원인 |
|------|---|------|--------|------|------|
| core-backend | #234 | 댓글 API | @kyago | 5일 | blocked 라벨 |

## 🟡 Warning (주의 필요)

| Repo | # | Task | 담당자 | 지연 | 원인 |
|------|---|------|--------|------|------|
| cm-land | #456 | 알림 연동 | @Garden | 3일 | 작업중 장기 |

## 📊 요약
- Critical: 1
- Warning: 1
- 총 블로커: 2
```

## 감지 규칙

### 지연 판정

| 상태 | 경과 시간 | 심각도 |
|------|----------|--------|
| 작업중 | 3-4일 | 🟡 Warning |
| 작업중 | 5일+ | 🔴 Critical |
| 리뷰요청 | 2일+ | 🟡 Warning |
| 리뷰요청 | 4일+ | 🔴 Critical |

### 블로커 유형

| 유형 | 감지 방법 | 심각도 |
|------|----------|--------|
| **장기 지연** | 상태 경과 시간 | 경과에 따라 |
| **명시적 차단** | blocked 라벨 | 🔴 Critical |
| **의존성 미해결** | 연결된 Issue 미완료 | 🟡 Warning |
| **담당자 미할당** | assignee 없음 | 🟡 Warning |

## API 호출

### Iteration Task 전체 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          id
          updatedAt
          content {
            ... on Issue {
              number
              title
              state
              createdAt
              updatedAt
              repository {
                name
              }
              labels(first: 10) {
                nodes {
                  name
                }
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
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              updatedAt
            }
          }
        }
      }
    }
  }
}'
```

### 지연 Task 필터링 (jq)

```bash
# 현재 Iteration에서 작업중 상태가 3일 이상인 Task
| jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(select(.status.name == "작업중"))
  | map(. + {
      days_since_update: (
        (($now | fromdate) - (.status.updatedAt | fromdate)) / 86400 | floor
      )
    })
  | map(select(.days_since_update >= 3))
  | sort_by(.days_since_update) | reverse
'
```

### blocked 라벨 Task

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
              labels(first: 10) {
                nodes {
                  name
                }
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
            }
          }
        }
      }
    }
  }
}' | jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(select(.content.labels.nodes | any(.name == "blocked")))
'
```

## 지연 일수 계산

```javascript
function calculateDelayDays(lastUpdate) {
  const now = new Date();
  const updated = new Date(lastUpdate);
  const diffMs = now - updated;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}
```

## Slack 알림

Critical 블로커 발견 시 자동 알림:

```bash
# notify-slack 호출
/SAX:slack #_협업 채널에 블로커 알림
```

**메시지 형식**:
```
🚨 *블로커 감지*

Sprint 12월 1/4에서 Critical 블로커가 발견되었습니다.

• core-backend#234 댓글 API (@kyago) - 5일 지연

즉시 확인이 필요합니다.
```

## 완료 메시지

```markdown
[SAX] Skill: detect-blockers 완료

# 🚨 블로커 현황

**기준일**: {report_date}
**Iteration**: {iteration_title}

## 🔴 Critical ({critical_count})
{critical_table}

## 🟡 Warning ({warning_count})
{warning_table}

## 📊 요약
- Critical: {critical_count}
- Warning: {warning_count}
- 총 블로커: {total_count}

{slack_notification_status}
```
