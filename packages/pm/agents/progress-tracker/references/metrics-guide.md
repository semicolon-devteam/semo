# Metrics Guide

> 진행도 측정 및 분석 가이드

## 핵심 지표

### 1. Sprint 진행률

```
진행률 = (완료 Point / 총 Point) × 100

예:
총 Point: 40
완료 Point: 28
진행률: 70%
```

### 2. Velocity

```
Velocity = 평균(최근 N Sprint 완료 Point)

권장 N = 3 (최근 3 Sprint)

예:
Sprint 21: 35pt
Sprint 22: 38pt
Sprint 23: 32pt
Velocity: 35pt/Sprint
```

### 3. 개인 완료율

```
개인 완료율 = (개인 완료 Point / 개인 할당 Point) × 100
```

### 4. 팀 효율성

```
팀 효율성 = (완료 Point / 팀 용량) × 100

예:
팀 용량: 40pt
완료 Point: 32pt
효율성: 80%
```

---

## 진행 상태 정의

### GitHub Projects 상태

| 상태 | 정의 | 전이 조건 |
|------|------|----------|
| **Todo** | 시작 전 | 초기 상태 |
| **In Progress** | 진행중 | 작업 시작 |
| **Review** | 리뷰 대기 | PR 생성 |
| **Done** | 완료 | PR 머지 |

### 상태 전이

```
Todo → In Progress → Review → Done
         ↑             ↓
         └── (수정 필요)
```

---

## 블로커 기준

### 지연 판정

| 상태 | 경과 시간 | 판정 |
|------|----------|------|
| In Progress | 1-2일 | 정상 |
| In Progress | 3-4일 | 🟡 Warning |
| In Progress | 5일+ | 🔴 Critical |
| Review | 1일 | 정상 |
| Review | 2일+ | 🟡 Warning |

### 블로커 유형

| 유형 | 설명 | 감지 방법 |
|------|------|----------|
| **지연** | 예상보다 오래 걸림 | 상태 경과 시간 |
| **차단** | 외부 의존성 | blocked 라벨 |
| **의존성** | 선행 Task 미완료 | 이슈 연결 |
| **리소스** | 담당자 부재 | 할당 상태 |

---

## 예측 모델

### 완료 예측

```
예상 완료일 = 현재일 + (남은 Point / 일일 Velocity)

일일 Velocity = Sprint Velocity / 10일

예:
남은 Point: 15
일일 Velocity: 3.5 (35pt/Sprint ÷ 10일)
예상 소요: 4.3일
```

### 리스크 점수

```
리스크 점수 = Σ(요소별 가중치 × 요소값)

요소:
- 지연 Task 수 × 2
- Critical 블로커 × 5
- 용량 초과율 × 1
- 완료율 미달 × 3
```

| 점수 | 리스크 수준 |
|------|------------|
| 0-5 | 🟢 Low |
| 6-10 | 🟡 Medium |
| 11+ | 🔴 High |

---

## 데이터 소스

### GitHub API

```bash
# Sprint Task 조회
gh api graphql -f query='
{
  repository(owner: "semicolon-devteam", name: "docs") {
    milestone(number: {N}) {
      title
      dueOn
      issues(first: 100) {
        nodes {
          number
          title
          state
          assignees(first: 3) {
            nodes { login }
          }
          labels(first: 10) {
            nodes { name }
          }
          projectItems(first: 1) {
            nodes {
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2SingleSelectField { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}'
```

### Point 추출

Point는 라벨에서 추출:

```bash
# point-N 라벨 파싱
labels.filter(l => l.startsWith('point-'))
      .map(l => parseInt(l.split('-')[1]))
```

---

## 대시보드 지표

### 실시간 표시 항목

| 지표 | 갱신 주기 | 표시 형식 |
|------|----------|----------|
| Sprint 진행률 | 실시간 | Progress Bar |
| 담당자별 현황 | 실시간 | 표 |
| 블로커 수 | 실시간 | 카운트 + 알림 |
| 남은 기간 | 일간 | D-N |
| Velocity | Sprint 종료 시 | 숫자 |

### 트렌드 분석

| 지표 | 비교 기간 | 분석 |
|------|----------|------|
| 완료율 | 전 Sprint 대비 | 상승/하락 |
| Velocity | 3 Sprint 평균 | 트렌드 |
| 블로커 | 전 Sprint 대비 | 개선/악화 |
