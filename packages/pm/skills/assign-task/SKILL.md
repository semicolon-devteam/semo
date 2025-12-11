---
name: assign-task
description: |
  작업자에게 Task 할당 + 작업 포인트 설정 + Slack 알림의 통합 워크플로우.
  Use when (1) Task 할당 시, (2) 담당자 지정 + 포인트 설정 + 알림 한 번에 처리,
  (3) /SEMO:pm assign 커맨드.
tools: [Bash, Read, AskUserQuestion]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: assign-task 호출` 메시지를 첫 줄에 출력하세요.

# assign-task Skill

> Task 할당의 완성된 프로세스: 담당자 지정 → 작업 포인트 확인/설정 → Slack 알림

## Purpose

Task를 작업자에게 할당할 때 필요한 모든 단계를 하나의 통합 워크플로우로 처리합니다.

### 통합 프로세스

| 단계 | 설명 | 조건 |
|------|------|------|
| 1. 담당자 지정 | Issue의 assignee 설정 | 필수 |
| 2. 작업 포인트 확인 | 기존 포인트 확인 | 자동 |
| 3. 작업 포인트 설정 | 누락 시 사용자 승인 후 설정 | 누락 시 |
| 4. Slack 알림 | 담당자에게 할당 알림 전송 | 필수 |

## Workflow

```text
Task 할당 요청
    ↓
1. Issue 정보 조회 (담당자, 작업 포인트)
    ↓
2. 담당자 지정 (gh issue edit --add-assignee)
    ↓
3. 작업 포인트 확인
   ├─ 있음 → Step 4로
   └─ 없음 → 포인트 제안 → 사용자 승인 → 설정
    ↓
4. Slack 알림 전송 (#_협업 채널)
    ↓
완료
```

## Input

### 기본 형식

```yaml
repo: "command-center"
number: 123
assignee: "kyago"           # GitHub 사용자명
estimate: 3                 # 선택: 직접 지정 시
```

### 복수 Task

```yaml
tasks:
  - repo: "command-center"
    number: 123
    assignee: "kyago"
  - repo: "cm-land"
    number: 456
    assignee: "Garden"
    estimate: 5             # 직접 지정
```

## 작업 포인트 자동 제안

### 제안 기준

| 조건 | 제안 포인트 | 근거 |
|------|------------|------|
| 라벨에 `bug` 포함 | 2pt | 버그 수정은 보통 반나절 |
| 라벨에 `enhancement` 포함 | 3pt | 기능 개선은 보통 1일 |
| 라벨에 `feature` 포함 | 5pt | 새 기능은 보통 2-3일 |
| 제목에 `리팩토링` 포함 | 5pt | 리팩토링은 보통 2-3일 |
| 제목에 `오타`, `typo` 포함 | 1pt | 단순 수정 |
| 기본값 | 3pt | 표준 Task |

### 사용자 승인 요청 형식

```markdown
⚠️ #123에 작업 포인트가 설정되지 않았습니다.

**Task 정보**:
- 제목: 댓글 기능 구현
- 라벨: enhancement, backend

**제안 포인트**: 3pt (M - 1일 규모)

| Point | 규모 | 설명 |
|-------|------|------|
| 1 | XS | 30분 이내 (오타 수정) |
| 2 | S | 반나절 (간단한 버그) |
| **3** | **M** | **1일 (API 추가)** ← 제안 |
| 5 | L | 2-3일 (기능 구현) |
| 8 | XL | 1주 (대규모 기능) |

제안된 3pt로 설정할까요? (다른 포인트 입력 가능)
```

## Output

### 성공 (전체 프로세스)

```markdown
[SEMO] Skill: assign-task 완료

✅ Task 할당 완료

| Repo | # | Task | 담당자 | 작업량 |
|------|---|------|--------|--------|
| command-center | #123 | 댓글 기능 구현 | @kyago | 3pt |

**처리 내역**:
- ✅ 담당자 지정: @kyago
- ✅ 작업 포인트: 3pt (신규 설정)
- ✅ Slack 알림: #_협업 채널 전송 완료
```

### 작업 포인트 기존재 시

```markdown
[SEMO] Skill: assign-task 완료

✅ Task 할당 완료

| Repo | # | Task | 담당자 | 작업량 |
|------|---|------|--------|--------|
| command-center | #123 | 댓글 기능 구현 | @kyago | 5pt |

**처리 내역**:
- ✅ 담당자 지정: @kyago
- ℹ️ 작업 포인트: 5pt (기존 유지)
- ✅ Slack 알림: #_협업 채널 전송 완료
```

## API 호출

### 1. Issue 정보 및 기존 작업 포인트 조회

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      title
      labels(first: 10) {
        nodes { name }
      }
      assignees(first: 5) {
        nodes { login }
      }
      projectItems(first: 10) {
        nodes {
          id
          project {
            number
            title
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
}' -f owner="semicolon-devteam" -f repo="command-center" -F number=123
```

### 2. 담당자 지정

```bash
gh issue edit 123 --repo semicolon-devteam/command-center --add-assignee kyago
```

### 3. 작업 포인트 설정 (누락 시)

> set-estimate 스킬 로직 참조

```bash
# 작업량 필드 ID 조회
gh api graphql -f query='
{
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      id
      field(name: "작업량") {
        ... on ProjectV2Field {
          id
        }
      }
    }
  }
}'

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

### 4. Slack 알림 전송

```bash
# SLACK_BOT_TOKEN은 semo-core/skills/notify-slack/SKILL.md 참조

# 담당자 Slack ID 조회
ASSIGNEE_SLACK_ID=$(curl -s "https://slack.com/api/users.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r --arg name "kyago" '
    .members[]
    | select(.deleted == false and .is_bot == false)
    | select(
        (.profile.display_name | ascii_downcase) == ($name | ascii_downcase) or
        (.name | ascii_downcase) == ($name | ascii_downcase)
      )
    | .id
  ' | head -1)

# 알림 전송
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#_협업",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "📋 *Task 할당 알림*\n\n<@'"$ASSIGNEE_SLACK_ID"'> 님에게 새 Task가 할당되었습니다."
        }
      },
      {
        "type": "section",
        "fields": [
          {"type": "mrkdwn", "text": "*Task*\n<https://github.com/semicolon-devteam/command-center/issues/123|#123 댓글 기능 구현>"},
          {"type": "mrkdwn", "text": "*작업량*\n3pt (M - 1일)"}
        ]
      }
    ]
  }'
```

## Slack 알림 메시지 형식

### Block Kit 구조

```json
{
  "channel": "#_협업",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "📋 *Task 할당 알림*\n\n<@{slack_id}> 님에게 새 Task가 할당되었습니다."
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Task*\n<{issue_url}|#{number} {title}>"
        },
        {
          "type": "mrkdwn",
          "text": "*작업량*\n{estimate}pt ({size} - {duration})"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "할당자: {assigner} | {timestamp}"
        }
      ]
    }
  ]
}
```

### 메시지 예시

```
📋 Task 할당 알림

@kyago 님에게 새 Task가 할당되었습니다.

Task                              작업량
#123 댓글 기능 구현               3pt (M - 1일)

할당자: @Reus | 2025-12-01 14:30
```

## 에러 처리

### 담당자를 찾을 수 없음

```markdown
❌ 담당자 지정 실패

`kyago123`은 유효하지 않은 GitHub 사용자명입니다.

**확인 사항**:
- GitHub 사용자명이 정확한지 확인
- 해당 사용자가 Organization 멤버인지 확인
```

### Slack 사용자 매칭 실패

```markdown
⚠️ Slack 멘션 불가

`kyago`에 해당하는 Slack 사용자를 찾을 수 없습니다.

**처리**:
- 담당자 지정: ✅ 완료
- 작업 포인트: ✅ 완료
- Slack 알림: ⚠️ 멘션 없이 전송됨
```

### 사용자가 작업 포인트 설정 거부

```markdown
ℹ️ 작업 포인트 설정 생략

사용자 요청에 따라 작업 포인트 설정을 생략합니다.

**처리 내역**:
- ✅ 담당자 지정: @kyago
- ⏭️ 작업 포인트: 사용자 요청으로 생략
- ✅ Slack 알림: 전송 완료 (포인트 미표시)
```

## 연관 워크플로우

### Sprint 계획 시

```text
1. audit-issues (백로그 검토)
2. assign-task (할당 + 포인트 + 알림)  ← THIS
3. assign-to-sprint (Sprint 배치)
```

### 긴급 Task 할당 시

```text
1. assign-task (즉시 할당)  ← THIS
2. start-task (작업 시작)
```

## SEMO Message Format

```markdown
[SEMO] Skill: assign-task 호출

[SEMO] Skill: assign-task - 작업 포인트 확인 요청

[SEMO] Skill: assign-task 완료
```

## Related

- [set-estimate](../set-estimate/SKILL.md) - 작업 포인트 설정 로직
- [start-task](../start-task/SKILL.md) - 작업 시작 (이터레이션 자동 할당)
- [assign-to-sprint](../assign-to-sprint/SKILL.md) - Sprint 할당
- [notify-slack](../../../semo-core/skills/notify-slack/SKILL.md) - Slack 알림 공통 스킬
