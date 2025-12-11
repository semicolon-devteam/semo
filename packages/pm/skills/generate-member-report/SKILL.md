---
name: generate-member-report
description: |
  인원별 업무 현황 리포트 생성. Use when (1) 담당자별 현황 조회,
  (2) /SEMO:report member 커맨드, (3) 업무량 분석.
tools: [Bash, Read, Write]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: generate-member-report 호출` 메시지를 첫 줄에 출력하세요.

# generate-member-report Skill

> 인원별 업무 현황 리포트 생성

## Purpose

팀원별 Task 할당 및 진행 현황을 분석하고 리포트를 생성합니다.

## Workflow

```
인원별 리포트 요청
    ↓
1. 대상 인원 확인 (특정/전체)
2. 인원별 Task 그룹화
3. 완료율/업무량 계산
4. 리포트 생성
    ↓
완료
```

## Input

```yaml
member: "@kyago"                  # 선택 (기본: 전체)
iteration_title: "12월 1/4"       # 선택 (기본: 현재 Iteration)
format: "markdown"                # 선택
```

## Output (전체)

```markdown
# 👥 팀원별 업무 현황

**Iteration**: 12월 1/4
**기간**: 2025-12-01 ~ 2025-12-07

## 📊 요약

| 담당자 | 할당 | 완료 | 작업중 | 대기 | 완료율 |
|--------|------|------|--------|------|--------|
| @kyago | 12pt | 8pt | 3pt | 1pt | 67% |
| @Garden | 10pt | 7pt | 3pt | 0pt | 70% |
| @Roki | 8pt | 6pt | 2pt | 0pt | 75% |

## 🔥 주요 현황

**가장 높은 완료율**: @Roki (75%)
**가장 많은 할당**: @kyago (12pt)
**블로커 보유**: @kyago (#234)
```

## Output (개인)

```markdown
# 👤 @kyago 업무 현황

**Iteration**: 12월 1/4
**기간**: 2025-12-01 ~ 2025-12-07

## 📊 요약

| 항목 | 값 |
|------|-----|
| 할당 작업량 | 12pt |
| 완료 작업량 | 8pt |
| 완료율 | 67% |

## ✅ 완료 (3)
- [x] #450 로그인 페이지 리팩토링 (3pt) - command-center
- [x] #451 에러 핸들링 개선 (2pt) - cm-land
- [x] #452 테스트 코드 작성 (3pt) - cm-land

## 🔄 작업중 (1)
- [ ] #456 댓글 API 구현 (3pt) - core-backend

## ⏳ 대기 (1)
- [ ] #458 알림 연동 (1pt) - command-center

## ⚠️ 블로커
- #234: 의존성 미해결 (3일 지연)
```

## API 호출

### 인원별 Task 조회 (GraphQL)

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
              assignees(first: 5) {
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

### 담당자별 그룹화 (jq)

```bash
# 특정 Iteration + 특정 담당자 필터링
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(select(.content.assignees.nodes | any(.login == "kyago")))
  | group_by(.status.name)
  | map({
      status: .[0].status.name,
      items: [.[] | {
        number: .content.number,
        title: .content.title,
        repo: .content.repository.name,
        workload: .workload.number
      }]
    })
'
```

### 전체 팀원 요약

```bash
# Iteration 필터링 후 담당자별 집계
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(. as $item | .content.assignees.nodes[] | {
      assignee: .login,
      status: $item.status.name,
      workload: ($item.workload.number // 0)
    })
  | group_by(.assignee)
  | map({
      assignee: .[0].assignee,
      total: ([.[].workload] | add),
      done: ([.[] | select(.status == "병합됨" or .status == "검수완료") | .workload] | add // 0),
      in_progress: ([.[] | select(.status == "작업중" or .status == "리뷰요청") | .workload] | add // 0),
      todo: ([.[] | select(.status == "검수대기") | .workload] | add // 0)
    })
  | map(. + {completion_rate: (if .total > 0 then ((.done / .total) * 100 | floor) else 0 end)})
'
```

## 완료율 계산

```javascript
function calculateCompletionRate(done, total) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}
```

## Semicolon 팀원 목록

| GitHub ID | 이름 | 기술영역 |
|-----------|------|----------|
| kyago | 강용준 | 백엔드 |
| garden92 | 서정원 | 프론트 |
| Roki-Noh | 노영록 | 프론트 |
| beomsun1234 | 장현봉 | 백엔드 |
| DwightKang | 강동현 | 운영/기획 |
| yeomso | 염현준 | 프론트 |
| reus-jeon | 전준영 | 운영/기획 |

## 완료 메시지

```markdown
[SEMO] Skill: generate-member-report 완료

# 👥 팀원별 업무 현황

**Iteration**: {iteration_title}

## 📊 요약

| 담당자 | 할당 | 완료 | 완료율 | 상태 |
|--------|------|------|--------|------|
{member_rows}

## 🔥 주요 현황

- **가장 높은 완료율**: {top_performer}
- **가장 많은 할당**: {most_assigned}
- **블로커 보유**: {blocked_members}
```
