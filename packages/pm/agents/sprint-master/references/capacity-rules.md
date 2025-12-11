# Capacity Rules (Iteration 기반)

> 팀 용량 계산 및 과할당 방지 규칙

## 기본 용량

### 개인 용량 (1주 Iteration 기준)

```
기본 용량 = 5 Point / 1주 Iteration
일일 용량 = 1 Point / 일 (주 5일 기준)
```

> **Note**: 기존 2주 Sprint 기준 10pt에서 1주 Iteration 기준 5pt로 조정

### 팀 용량

```
팀 용량 = Σ(개인 용량)

예: 4명 팀
팀 용량 = 4 × 5 = 20 Point / Iteration
```

---

## 용량 조정

### 휴가/부재 (1주 기준)

| 부재 일수 | 용량 감소 |
|-----------|----------|
| 1일 | -1 Point |
| 2일 | -2 Point |
| 3일 | -3 Point |
| 1주 (전체) | -5 Point |

### 회의 부담

| 역할 | 용량 감소 |
|------|----------|
| 일반 개발자 | -0.5 Point (10%) |
| 테크 리드 | -1 Point (20%) |
| PM | -1.5 Point (30%) |

### 온보딩

신규 입사자:
- 첫 2주: 기본 용량의 50%
- 3-4주: 기본 용량의 75%
- 5주~: 정상

---

## Semicolon 팀 용량

### 팀원 목록

| 이름 | GitHub | 기술영역 | 주간 용량 |
|------|--------|----------|----------|
| kyago | @kyago | 백엔드 | 5pt |
| Garden | @garden92 | 프론트 | 5pt |
| Roki | @Roki-Noh | 프론트 | 5pt |
| bon | @beomsun1234 | 백엔드 | 5pt |
| dwight.k | @DwightKang | 운영/기획 | 5pt |
| Yeomso | @yeomso | 프론트 | 5pt |
| Reus | @reus-jeon | 운영/기획 | 3.5pt (-30%) |

### Iteration 용량 예시

```
12월 1/4 용량 계산:
- kyago: 5pt
- Garden: 5pt (휴가 1일: -1pt) = 4pt
- Roki: 5pt
- bon: 5pt
- Reus: 3.5pt

총 용량: 22.5pt
권장 할당: 20pt (90% 버퍼)
```

---

## 과할당 방지

### 경고 임계값

| 수준 | 할당률 | 조치 |
|------|--------|------|
| 🟢 정상 | ~80% | - |
| 🟡 주의 | 80-100% | 경고 메시지 |
| 🔴 위험 | 100%+ | 할당 차단 권고 |

### 과할당 시 메시지

```markdown
⚠️ **용량 초과 경고**

현재 Iteration 할당량이 팀 용량을 초과합니다.

- 팀 용량: 20pt
- 현재 할당: 23pt (+3pt 초과)

**권장 조치**:
1. 우선순위 낮은 Task 다음 Iteration으로 이관
2. Task 분할하여 일부만 포함
3. 추가 리소스 확보
```

---

## 균형 배분

### 개인별 할당 규칙

```
개인 할당 = 개인 용량의 80-100%

예: kyago (용량 5pt)
권장 할당: 4-5pt
```

### 불균형 감지

```markdown
⚠️ **업무 불균형 감지**

| 담당자 | 할당 | 용량 | 비율 |
|--------|------|------|------|
| @kyago | 7pt | 5pt | 140% ⚠️ |
| @Garden | 2pt | 5pt | 40% |

@kyago에게 과할당되었습니다.
일부 Task를 @Garden에게 재배정을 권장합니다.
```

---

## 용량 조회 API

### Iteration별 할당 현황

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              assignees(first: 5) {
                nodes { login }
              }
            }
          }
          iteration: fieldValueByName(name: "이터레이션") {
            ... on ProjectV2ItemFieldIterationValue {
              title
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

### 담당자별 작업량 집계

```bash
# 특정 Iteration의 담당자별 할당량
| jq '
  .data.organization.projectV2.items.nodes
  | map(select(.iteration.title == "12월 1/4"))
  | map(. as $item | .content.assignees.nodes[] | {
      assignee: .login,
      workload: ($item.workload.number // 0)
    })
  | group_by(.assignee)
  | map({
      assignee: .[0].assignee,
      total_workload: ([.[].workload] | add)
    })
'
```

### 작업량 필드

GitHub Projects "작업량" 필드 활용:
- 타입: Number
- 값: 1, 2, 3, 5, 8, 13 (피보나치)

```bash
# 작업량 설정
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
    projectV2Item { id }
  }
}' \
  -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="{item_id}" \
  -f fieldId="{workload_field_id}" \
  -F value=3
```
