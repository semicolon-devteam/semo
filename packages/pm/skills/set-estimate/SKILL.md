---
name: set-estimate
description: |
  Task에 작업량(Estimate Point) 설정. Use when (1) 백로그 그루밍 시 작업량 추정,
  (2) Sprint 계획 전 작업량 설정, (3) 기존 Task 작업량 수정, (4) /SAX:sprint estimate 커맨드.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: set-estimate 호출` 메시지를 첫 줄에 출력하세요.

# set-estimate Skill

> Task에 작업량(Estimate Point)을 독립적으로 설정

## Purpose

Sprint 할당 없이 Task의 작업량만 독립적으로 설정합니다. 백로그 그루밍, 계획 포커, 사전 추정 등의 워크플로우를 지원합니다.

## Workflow

```
작업량 설정 요청
    ↓
1. 대상 Task(Issue) 확인
2. Projects Item ID 조회
3. 작업량 필드 값 설정
4. 결과 출력
    ↓
완료
```

## Input

### 단일 Task

```yaml
repo: "command-center"
number: 123
estimate: 3              # 피보나치: 1, 2, 3, 5, 8, 13
```

### 복수 Task

```yaml
tasks:
  - repo: "command-center"
    number: 123
    estimate: 3
  - repo: "cm-land"
    number: 456
    estimate: 5
  - repo: "command-center"
    number: 789
    estimate: 8
```

## Estimate Point 가이드

| Point | 규모 | 예시 |
|-------|------|------|
| **1** | XS - 30분 이내 | 오타 수정, 설정값 변경 |
| **2** | S - 반나절 | 간단한 버그 수정, 작은 UI 변경 |
| **3** | M - 1일 | 새 API 엔드포인트, 컴포넌트 추가 |
| **5** | L - 2~3일 | 기능 구현, 복잡한 버그 수정 |
| **8** | XL - 1주 | 대규모 기능, 리팩토링 |
| **13** | XXL - 1주 이상 | 분할 필요, Epic 검토 권장 |

> **⚠️ 13pt 이상**: Task 분할을 권장합니다.

## Output

### 성공

```markdown
[SAX] Skill: set-estimate 완료

✅ 3개 Task에 작업량을 설정했습니다.

| Repo | # | Task | 작업량 | 담당자 |
|------|---|------|--------|--------|
| command-center | #123 | 댓글 API | 3pt | @kyago |
| cm-land | #456 | 알림 연동 | 5pt | @Garden |
| command-center | #789 | 권한 관리 | 8pt | @Roki |

**총 작업량**: 16pt
```

### 13pt 이상 경고

```markdown
[SAX] Skill: set-estimate 완료

✅ 1개 Task에 작업량을 설정했습니다.

| Repo | # | Task | 작업량 | 담당자 |
|------|---|------|--------|--------|
| command-center | #999 | 결제 시스템 | 13pt | @bon |

⚠️ **분할 권장**: #999는 13pt로 대규모 작업입니다.
- Epic으로 승격하거나 여러 Task로 분할을 검토하세요.
```

## API 호출

### 1. Issue Node ID 조회

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

### 2. 작업량 필드 ID 조회

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      field(name: "작업량") {
        ... on ProjectV2Field {
          id
          name
        }
      }
    }
  }
}'
```

### 3. Issue가 Project에 없는 경우 추가

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

### 4. 작업량 설정

```bash
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

## 현재 작업량 조회

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      title
      projectItems(first: 10) {
        nodes {
          fieldValueByName(name: "작업량") {
            ... on ProjectV2ItemFieldNumberValue {
              number
            }
          }
        }
      }
    }
  }
}' -f owner="semicolon-devteam" -f repo="command-center" -F number=123
```

## 에러 처리

### Issue가 Projects에 연결되지 않은 경우

```markdown
⚠️ #123이 이슈관리 프로젝트에 연결되어 있지 않습니다.

자동으로 프로젝트에 추가 후 작업량을 설정합니다...

✅ 완료: #123을 이슈관리 프로젝트에 추가하고 작업량 3pt를 설정했습니다.
```

### 유효하지 않은 작업량

```markdown
❌ 유효하지 않은 작업량입니다.

입력값: 4
허용값: 1, 2, 3, 5, 8, 13 (피보나치 수열)

가장 가까운 값으로 설정하시겠습니까?
- 3pt (작게)
- 5pt (크게)
```

## 연관 워크플로우

### 백로그 그루밍

```
1. audit-issues로 작업량 미설정 Task 확인
2. set-estimate로 작업량 설정
3. assign-to-sprint로 Sprint 할당
```

### Sprint 계획

```
1. 백로그에서 Sprint 대상 Task 선정
2. set-estimate로 작업량 사전 설정
3. assign-to-sprint로 Sprint 할당 + 용량 체크
```

## Related

- [assign-to-sprint](../assign-to-sprint/SKILL.md) - Sprint 할당 (작업량 동시 설정 가능)
- [audit-issues](../audit-issues/SKILL.md) - 작업량 미설정 Task 감지
- [calculate-velocity](../calculate-velocity/SKILL.md) - Velocity 계산
