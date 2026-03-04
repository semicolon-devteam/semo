---
name: sprint
description: |
  Sprint 관리 (시작/종료/회고). Use when (1) 새 Sprint 시작,
  (2) Sprint 종료, (3) 회고 작성, (4) /SEMO:sprint 커맨드.
tools: [Bash, Read, Write]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: sprint 호출 - {action}` 메시지를 첫 줄에 출력하세요.

# sprint Skill

> Sprint(Iteration) 관리: 시작, 종료, 회고 통합 스킬

## Purpose

GitHub Projects Iteration을 Sprint로 활용하여 목표 설정, 진행 관리, 종료 및 회고를 처리합니다.

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **create** | Sprint 시작 및 목표 설정 | "Sprint 시작", "새 Iteration" |
| **close** | Sprint 종료 및 회고 | "Sprint 종료", "회고 작성" |
| **status** | Sprint 현황 조회 | "Sprint 진행 상황" |

---

## Action: create

Sprint를 시작하고 목표를 설정합니다.

### Input

```yaml
iteration_title: "12월 1/4"           # 필수 (GitHub Projects Iteration 이름)
goals:                                # 선택
  - "댓글 기능 완성"
  - "알림 연동 시작"
notify_slack: true                    # 선택
```

### Workflow

```
Sprint 시작 요청
    ↓
1. 현재/다음 Iteration 조회
2. Sprint Issue 생성 (docs 레포)
3. Sprint 목표 설정
4. 알림 전송 (선택)
    ↓
완료
```

### API 호출

#### Iteration 조회 (GraphQL)

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
}'
```

#### Sprint Issue 생성

```bash
gh issue create \
  --repo semicolon-devteam/docs \
  --title "🏃 Sprint: 12월 1/4" \
  --label "sprint,sprint-current" \
  --body "$(cat <<'EOF'
# 🏃 Sprint: 12월 1/4

**Iteration**: 12월 1/4
**기간**: 2025-12-01 ~ 2025-12-07

## 🎯 Sprint 목표
- 댓글 기능 완성
- 알림 연동 시작

## 📋 포함된 Task
> GitHub Projects "이슈관리" → 이터레이션 "12월 1/4" 필터로 확인

[📊 Projects 보기](https://github.com/orgs/semicolon-devteam/projects/1/views/1?filterQuery=iteration:"12월 1/4")

## 📈 진행 현황
| 상태 | 개수 |
|------|------|
| 작업중 | 0 |
| 완료 | 0 |
| 대기 | 0 |
EOF
)"
```

#### 이전 Sprint Issue 정리

```bash
# 이전 sprint-current 라벨 제거
gh issue list \
  --repo semicolon-devteam/docs \
  --label "sprint-current" \
  --json number \
  | jq -r '.[].number' \
  | xargs -I {} gh issue edit {} --remove-label "sprint-current" --add-label "sprint-closed"
```

### Output

```markdown
[SEMO] Skill: sprint 완료 (create)

✅ Sprint "12월 1/4" 시작

**기간**: 2025-12-01 ~ 2025-12-07 (1주)
**Sprint Issue**: [#123](issue_url)
```

---

## Action: close

Sprint를 종료하고 회고를 작성합니다.

### Input

```yaml
iteration_title: "11월 4/4"
next_iteration: "12월 1/4"
retrospective:
  good: ["API 개발 순조로움"]
  improve: ["테스트 커버리지 부족"]
```

### Workflow

```
Sprint 종료 요청
    ↓
1. Iteration의 완료/미완료 Task 집계
2. Velocity 계산
3. 회고 요약 생성
4. Sprint Issue에 회고 추가
5. 미완료 Task → 다음 Iteration 이관
6. sprint-current 라벨 제거
    ↓
완료
```

### Output

```markdown
[SEMO] Skill: sprint 완료 (close)

✅ Sprint "11월 4/4" 종료 완료

**완료**: 8/10 Task (80%)
**Velocity**: 24pt
**미완료 이관**: 2 Task → 12월 1/4
```

---

## Sprint Issue 템플릿

```markdown
# 🏃 Sprint: {iteration_title}

**Iteration**: {iteration_title}
**기간**: {start_date} ~ {end_date}

## 🎯 Sprint 목표
{goals_list}

## 📋 포함된 Task
> GitHub Projects "이슈관리" → 이터레이션 "{iteration_title}" 필터로 확인

[📊 Projects 보기](https://github.com/orgs/semicolon-devteam/projects/1/views/1?filterQuery=iteration:"{iteration_title}")

## 📈 진행 현황
| 상태 | 개수 | Point |
|------|------|-------|
| 작업중 | {in_progress} | {ip_points}pt |
| 완료 | {done} | {done_points}pt |
| 대기 | {todo} | {todo_points}pt |

## 📊 용량
- **총 할당**: {total_points}pt
- **팀 용량**: {capacity}pt
```

---

## Related

- `board` - Projects 보드 관리
- `task` - Task 할당 및 상태 관리
- `report` - Sprint 리포트 생성
