# assign-task API 호출 상세

## 1. Issue 정보 및 기존 작업 포인트 조회

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

## 2. 담당자 지정

```bash
gh issue edit 123 --repo semicolon-devteam/command-center --add-assignee kyago
```

## 3. 작업 포인트 설정 (누락 시)

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

## 4. Slack 알림 전송

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
