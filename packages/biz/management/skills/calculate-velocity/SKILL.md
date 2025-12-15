---
name: calculate-velocity
description: |
  팀 Velocity 계산. Use when (1) Sprint 종료 시 Velocity 기록,
  (2) 생산성 분석, (3) 일정 예측 시.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: calculate-velocity 호출` 메시지를 첫 줄에 출력하세요.

# calculate-velocity Skill

> 팀 Velocity 계산 및 트렌드 분석

## Purpose

최근 Iteration(Sprint)들의 완료 작업량을 기반으로 팀 Velocity를 계산합니다.

## Workflow

```
Velocity 계산 요청
    ↓
1. 최근 N Iteration 조회 (기본 4주)
2. Iteration별 완료 작업량 집계
3. 평균 Velocity 계산
4. 트렌드 분석
    ↓
완료
```

## Input

```yaml
iteration_count: 4                # 선택 (기본 4, 1개월 분량)
include_current: false            # 선택 (진행중 Iteration 포함 여부)
```

## Output

```markdown
[SEMO] Skill: calculate-velocity 완료

📊 팀 Velocity 분석

**평균 Velocity**: 12pt/주

| Iteration | 완료 작업량 | 완료율 |
|-----------|-------------|--------|
| 11월 1/4 | 15pt | 88% |
| 11월 2/4 | 12pt | 75% |
| 11월 3/4 | 10pt | 67% |
| 11월 4/4 | 11pt | 73% |

**트렌드**: ↘️ 소폭 하락 (-8%)
```

## API 호출

### 완료된 Iteration 목록 조회

```bash
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
              duration
            }
          }
        }
      }
    }
  }
}' | jq '.data.organization.projectV2.field.configuration.completedIterations | .[0:4]'
```

### Iteration별 완료 작업량

```bash
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              state
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
}' | jq '
  .data.organization.projectV2.items.nodes
  | group_by(.iteration.title)
  | map({
      iteration: .[0].iteration.title,
      total: ([.[].workload.number // 0] | add),
      completed: ([.[] | select(.content.state == "CLOSED") | .workload.number // 0] | add)
    })
  | sort_by(.iteration) | reverse
'
```

## Velocity 계산

```javascript
function calculateVelocity(iterations) {
  const velocities = iterations.map(i => i.completed || 0);
  const sum = velocities.reduce((a, b) => a + b, 0);
  return sum / velocities.length;
}

// 예 (1주 단위):
// 11월 1/4: 15pt
// 11월 2/4: 12pt
// 11월 3/4: 10pt
// 11월 4/4: 11pt
// 평균: (15 + 12 + 10 + 11) / 4 = 12pt/주
```

## 트렌드 분석

```javascript
function analyzeTrend(velocities) {
  const latest = velocities[0];
  const previous = velocities[1];
  const diff = ((latest - previous) / previous) * 100;

  if (diff > 10) return { icon: '📈', text: '상승', diff };
  if (diff > 0) return { icon: '↗️', text: '소폭 상승', diff };
  if (diff > -10) return { icon: '↘️', text: '소폭 하락', diff };
  return { icon: '📉', text: '하락', diff };
}
```

## 일정 예측

Velocity를 활용한 일정 예측:

```javascript
function predictCompletion(remainingPoints, weeklyVelocity) {
  const weeksNeeded = remainingPoints / weeklyVelocity;
  const daysNeeded = weeksNeeded * 5; // 1주 = 5 영업일

  return {
    weeks: Math.ceil(weeksNeeded),
    days: Math.ceil(daysNeeded),
    estimatedDate: addBusinessDays(new Date(), daysNeeded)
  };
}

// 예:
// 남은 작업량: 24pt
// Velocity: 12pt/주
// 예상: 2주 (10 영업일)
```

## 완료 메시지

```markdown
[SEMO] Skill: calculate-velocity 완료

## 📊 팀 Velocity 분석

**평균 Velocity**: {avg_velocity}pt/주

### Iteration별 실적

| Iteration | 완료 작업량 | 할당 | 완료율 |
|-----------|-------------|------|--------|
{iteration_rows}

### 트렌드
{trend_icon} **{trend_text}** ({trend_diff:+.1f}%)

### 예측
현재 Velocity 기준:
- 6pt 작업: ~3일 (반주)
- 12pt 작업: ~1주
- 24pt 작업: ~2주
- 48pt 작업: ~1개월
```
