# Sprint Workflow (Iteration 기반)

> Sprint(Iteration) 생명주기 관리 워크플로우

## Sprint 생명주기

```
[Planning] → [Active] → [Review] → [Closed]
    ↓           ↓          ↓          ↓
  Task 선정   Daily 추적  회고 작성   Velocity 기록
```

> **Note**: GitHub Projects의 Iteration은 1주 단위로 자동 생성됩니다.
> Sprint는 해당 Iteration을 "활성화"하고 목표를 설정하는 개념입니다.

## Iteration 구조 (Semicolon)

```yaml
주기: 1주 (7일)
시작: 월요일
명명: "{월} {주차}/{월 총주차}"  # 예: "12월 1/4"

예시:
  - 12월 1/4: 2025-12-01 ~ 2025-12-07
  - 12월 2/4: 2025-12-08 ~ 2025-12-14
  - 12월 3/4: 2025-12-15 ~ 2025-12-21
  - 12월 4/4: 2025-12-22 ~ 2025-12-28
```

---

## Phase 1: Planning (계획)

### 1.1 현재 Iteration 확인

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

### 1.2 Sprint Issue 생성

```bash
gh issue create \
  --repo semicolon-devteam/docs \
  --title "🏃 Sprint: 12월 1/4" \
  --label "sprint,sprint-current" \
  --body "Sprint 목표 및 현황..."
```

### 1.3 Backlog 조회

```bash
# Projects에서 Iteration 미할당 Task 조회
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
}' | jq '[.data.organization.projectV2.items.nodes[] | select(.iteration == null)]'
```

### 1.4 Task 할당 (Iteration 설정)

```bash
# GraphQL mutation으로 Iteration 필드 값 설정
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
  -f fieldId="PVTIF_lADOC01-Rc4AtDz2zgj4d7g" \
  -f iterationId="{iteration_id}"
```

---

## Phase 2: Active (실행)

### 2.1 Daily 추적

매일 확인 사항:
- [ ] 작업중 Task 상태 확인
- [ ] 블로커 감지 (3일+ 정체)
- [ ] 예상 지연 파악

### 2.2 상태 업데이트

Projects #1에서 Task 상태 관리:

| 상태 | 의미 |
|------|------|
| 검수대기 | 대기 |
| 작업중 | 진행중 |
| 확인요청 | 리뷰 필요 |
| 리뷰요청 | 코드 리뷰 |
| 테스트중 | QA |
| 병합됨 | 완료 |

### 2.3 블로커 대응

블로커 발견 시:
1. `blocked` 라벨 추가
2. 블로킹 사유 코멘트
3. Slack 알림 (`/SAX:slack`)

---

## Phase 3: Review (검토)

### 3.1 Sprint 종료일

Iteration 종료일(일요일) 전:
1. 미완료 Task 확인
2. 다음 Iteration 이관 결정
3. 회고 준비

### 3.2 회고 작성

Sprint Issue에 회고 추가:

```markdown
## 📝 Sprint 회고

### ✅ 잘된 점
- {good_1}
- {good_2}

### 🔧 개선할 점
- {improve_1}
- {improve_2}

### 📊 통계
| 항목 | 값 |
|------|-----|
| 완료 Task | {done}/{total} ({rate}%) |
| Velocity | {velocity}pt |
| 미완료 이관 | {carry_over} Task |
```

---

## Phase 4: Closed (종료)

### 4.1 Sprint Issue 종료

```bash
# sprint-current → sprint-closed
gh issue edit {sprint_issue_number} \
  --repo semicolon-devteam/docs \
  --remove-label "sprint-current" \
  --add-label "sprint-closed" \
  --state closed
```

### 4.2 미완료 Task 이관

```bash
# 다음 Iteration으로 이관 (GraphQL)
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
  -f fieldId="PVTIF_lADOC01-Rc4AtDz2zgj4d7g" \
  -f iterationId="{next_iteration_id}"
```

### 4.3 Velocity 기록

```markdown
## 📈 Velocity 트렌드

| Iteration | 완료 작업량 | 완료율 |
|-----------|-------------|--------|
| 11월 4/4 | 12pt | 75% |
| 12월 1/4 | 15pt | 88% |

**평균 Velocity**: 13.5pt/주
```

---

## Sprint 간 전환

```
Iteration N 종료 (자동)
    ↓
미완료 Task → Iteration N+1 이관 (수동)
    ↓
Sprint N Issue 종료
    ↓
Sprint N+1 Issue 생성
```

> Iteration은 자동으로 진행되지만, Sprint Issue 관리와 Task 이관은 수동으로 처리합니다.

## 예외 상황

### 긴급 Task 추가

Sprint 중간에 긴급 Task 추가 시:
1. 용량 재계산
2. 기존 Task 우선순위 조정
3. 필요시 Task 다음 Iteration 이관

### Sprint 취소

Sprint 취소 시:
1. 모든 Task → Iteration 필드 해제
2. Sprint Issue 종료 (취소 사유 기록)
