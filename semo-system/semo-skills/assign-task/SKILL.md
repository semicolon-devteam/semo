---
name: assign-task
description: |
  GitHub Issue 업무 할당 및 작업량 자동 산정. Use when (1) Issue assignee 지정,
  (2) 작업량(Point) 자동 계산, (3) 이슈 본문 체크리스트 추가, (4) Project 필드 업데이트,
  (5) Slack 담당자 알림.
tools: [Bash, Read, Edit, mcp__github__*, mcp__semo-integrations__semo_get_slack_token]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: assign-task 호출 - #{issue_number} → @{assignee}` 시스템 메시지를 첫 줄에 출력하세요.

# assign-task Skill

> GitHub Issue 업무 할당 + 작업량 자동 산정 + Slack 알림

## Purpose

Issue에 담당자를 할당하고, 작업량을 자동으로 산정하여 이슈 본문과 Project 필드를 업데이트합니다.

### 핵심 기능

| 기능 | 설명 |
|------|------|
| **Assignee 지정** | GitHub Issue에 담당자 할당 |
| **작업량 산정** | Estimation Guide 기반 Point 자동 계산 |
| **이슈 본문 업데이트** | 체크리스트 형식으로 작업량 명세 추가 |
| **Project 필드 갱신** | "작업량" 필드에 총점 숫자 입력 |
| **Slack 알림** | 담당자에게 업무 할당 알림 발송 |

## Input

```javascript
skill: assign-task({
  issue: 123,                    // Issue 번호 (필수)
  assignee: "username",          // 담당자 GitHub ID (필수)
  tasks: [                       // 작업 목록 (선택 - 미입력시 이슈 분석)
    { name: "API 엔드포인트 구현", point: 2 },
    { name: "DTO 클래스 작성", point: 1 }
  ],
  notify: true                   // Slack 알림 여부 (기본: true)
});
```

## Execution Flow

```text
1. Issue 정보 조회
   ↓
2. 작업 목록 분석 (입력값 또는 이슈 본문 파싱)
   ↓
3. 작업량 산정 (Estimation Guide 기준)
   ↓
4. Issue 업데이트 (Assignee + 본문)
   ↓
5. Project 필드 업데이트 (작업량)
   ↓
6. Slack 알림 발송 (선택)
```

### Step 1: Issue 정보 조회

```bash
gh issue view {number} --repo {owner}/{repo} --json title,body,labels,assignees,projectItems
```

### Step 2: 작업 목록 분석

**입력값이 있는 경우**: 입력된 tasks 배열 사용

**입력값이 없는 경우**: 이슈 본문에서 TODO/체크리스트 추출

```bash
# 이슈 본문에서 체크리스트 항목 추출
gh issue view {number} --json body --jq '.body' | grep -E '^\s*-\s*\[[ x]\]'
```

### Step 3: 작업량 산정

> **📖 Reference**: [estimation-guide.md](references/estimation-guide.md)

각 작업에 Point를 부여:
- 기존 Point가 있으면 그대로 사용
- 없으면 작업 유형별 기본값 적용

### Step 4: Issue 업데이트

**4.1 Assignee 지정**

```bash
gh issue edit {number} --add-assignee {username}
```

**4.2 본문에 작업량 체크리스트 추가**

기존 본문 끝에 아래 섹션 추가:

```markdown
---

## 📊 작업량 산정

- [ ] API 엔드포인트 구현: 2점
- [ ] DTO 클래스 작성: 1점
- [ ] 테스트 코드 작성: 1점

**총점: 4점** (예상 소요: 2일)
```

### Step 5: Project 필드 업데이트

> **⚠️ 중요**: 이슈관리 보드의 "작업량" 필드에 총점 숫자만 입력

```bash
# Step 5.1: Project Item ID 조회
ITEM_ID=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        projectItems(first: 10) {
          nodes {
            id
            project { title }
          }
        }
      }
    }
  }
' -f owner="{owner}" -f repo="{repo}" -F number={number} \
  --jq '.data.repository.issue.projectItems.nodes[] | select(.project.title=="이슈관리") | .id')

# Step 5.2: 작업량 필드 ID 조회
FIELD_ID=$(gh api graphql -f query='
  query {
    organization(login: "{owner}") {
      projectV2(number: 1) {
        field(name: "작업량") {
          ... on ProjectV2Field {
            id
          }
        }
      }
    }
  }
' --jq '.data.organization.projectV2.field.id')

# Step 5.3: 필드 값 업데이트 (숫자)
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $value }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="{PROJECT_ID}" -f itemId="$ITEM_ID" -f fieldId="$FIELD_ID" -F value={total_points}
```

### Step 6: Slack 알림 발송

> **📖 Reference**: [slack-template.md](references/slack-template.md)

```bash
# Token 획득
TOKEN=$(mcp__semo-integrations__semo_get_slack_token)

# 사용자 Slack ID 조회
SLACK_ID=$(curl -s 'https://slack.com/api/users.list' \
  -H "Authorization: Bearer $TOKEN" | \
  jq -r '.members[] | select(.profile.display_name=="{display_name}" or .name=="{username}") | .id')

# 메시지 발송
curl -s -X POST 'https://slack.com/api/chat.postMessage' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d @- << 'EOF'
{
  "channel": "C09KNL91QBZ",
  "text": "📋 새 업무가 할당되었습니다",
  "blocks": [...]
}
EOF
```

## Output Format

```markdown
[SEMO] Skill: assign-task 완료

## ✅ 업무 할당 완료

**Issue**: #123 - [Task 제목]
**담당자**: @username

### 📊 작업량 산정

| 작업 | Point |
|------|-------|
| API 엔드포인트 구현 | 2 |
| DTO 클래스 작성 | 1 |
| 테스트 코드 작성 | 1 |
| **총점** | **4** |

**예상 소요**: 2일 (1 Point = 0.5일)

### 업데이트 내역

- [x] Assignee 지정: @username
- [x] 이슈 본문 작업량 체크리스트 추가
- [x] Project 필드(작업량): 4
- [x] Slack 알림 발송: <@U12345678>
```

## Error Handling

| 에러 | 처리 |
|------|------|
| Issue not found | 에러 메시지 출력 후 종료 |
| Invalid assignee | 유효한 GitHub username 요청 |
| Project 미연결 | 이슈관리 보드 연결 후 재시도 |
| Slack ID 미발견 | 경고 출력, 할당은 계속 진행 |

## References

- [Estimation Guide](references/estimation-guide.md) - 작업량 산정 기준
- [Slack Template](references/slack-template.md) - 알림 메시지 템플릿

## Related Skills

- [notify-slack](../notify-slack/SKILL.md) - Slack 알림 공통 스킬
- [complete-draft-task](../../semo-core/skills/complete-draft-task/SKILL.md) - Draft Task 완성
- [estimate-epic-timeline](../../semo-core/skills/estimate-epic-timeline/SKILL.md) - Epic 일정 예측
