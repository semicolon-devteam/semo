---
name: sync-project-status
description: |
  GitHub Projects 상태 동기화. Use when (1) 상태 불일치 수정,
  (2) Projects 데이터 갱신, (3) 일괄 상태 업데이트.
tools: [Bash, Read]
model: inherit
---

> **시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: sync-project-status 호출` 메시지를 첫 줄에 출력하세요.

# sync-project-status Skill

> GitHub Projects 상태 동기화

## Purpose

Issue 상태와 GitHub Projects 상태를 동기화하고 불일치를 수정합니다.

## Workflow

```
동기화 요청
    ↓
1. Projects 현재 상태 조회
2. Issue 실제 상태 조회
3. 불일치 감지
4. 상태 업데이트
    ↓
완료
```

## Input

```yaml
project_number: 1                 # 선택 (기본: 이슈관리)
sprint_name: "Sprint 23"          # 선택 (특정 Sprint만)
dry_run: false                    # 선택 (실제 변경 없이 확인만)
```

## Output

```markdown
[SAX] Skill: sync-project-status 완료

✅ Projects 동기화 완료

**동기화된 항목**: 3개
**불일치 수정**: 2개

| # | Task | 이전 상태 | 새 상태 |
|---|------|----------|---------|
| #234 | 댓글 API | Todo | In Progress |
| #456 | 알림 연동 | In Progress | Done |
```

## API 호출

### Projects 상태 조회

```bash
# Projects #1 (이슈관리) 항목 조회
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
}'
```

### Issue 상태 조회

```bash
gh issue view {number} \
  --repo semicolon-devteam/docs \
  --json state,labels
```

### Projects 상태 업데이트

```bash
# Projects 항목 상태 변경
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: "{project_id}"
      itemId: "{item_id}"
      fieldId: "{status_field_id}"
      value: { singleSelectOptionId: "{option_id}" }
    }
  ) {
    projectV2Item { id }
  }
}'
```

## 상태 매핑

### Issue State → Projects Status

| Issue State | Projects Status |
|-------------|-----------------|
| OPEN (라벨 없음) | Todo |
| OPEN (in-progress) | In Progress |
| OPEN (review) | Review |
| CLOSED | Done |

### 자동 감지 규칙

```javascript
function detectExpectedStatus(issue) {
  if (issue.state === 'CLOSED') return 'Done';

  const labels = issue.labels.map(l => l.name);

  if (labels.includes('review')) return 'Review';
  if (labels.includes('in-progress')) return 'In Progress';

  return 'Todo';
}
```

## 불일치 유형

| 유형 | 설명 | 조치 |
|------|------|------|
| **상태 불일치** | Issue/Projects 상태 다름 | 자동 수정 |
| **누락** | Issue가 Projects에 없음 | 경고 |
| **고아 항목** | Projects에만 있음 | 경고 |

## Dry Run 모드

실제 변경 없이 불일치만 확인:

```bash
# dry_run: true 시 출력
[SAX] Skill: sync-project-status (Dry Run)

📋 불일치 감지됨 (변경 없음)

| # | Task | 현재 | 예상 | 조치 |
|---|------|------|------|------|
| #234 | 댓글 API | Todo | In Progress | 업데이트 필요 |
| #456 | 알림 연동 | In Progress | Done | 업데이트 필요 |

실제 동기화: dry_run: false로 재실행
```

## 완료 메시지

```markdown
[SAX] Skill: sync-project-status 완료

✅ Projects 동기화 완료

**프로젝트**: 이슈관리 (#1)
**검사 항목**: {total_count}개
**동기화됨**: {synced_count}개
**불일치 수정**: {fixed_count}개

{changes_table}

{warnings}
```
