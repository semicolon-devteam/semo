---
name: complete-draft-task
description: |
  Draft Task를 완성된 작업 Task로 변환. Use when:
  (1) SDD Phase 5 완료 후 Draft → Task 전환, (2) spec.md 기반 AC 추가 필요,
  (3) Epic Sub-issue 연결 필요, (4) draft 라벨 제거 및 메타데이터 업데이트.
tools: [Bash, Read, Edit, GitHub CLI]
location: project
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: complete-draft-task 호출 - {Epic/Feature}` 시스템 메시지를 첫 줄에 출력하세요.

# Complete Draft Task

> SAX-PO Draft Task를 SAX-Next 완성된 Task로 변환하는 Skill

## Quick Start

```javascript
// create-issues Skill 완료 후 자동 호출
skill: complete-draft-task({
  draftIssues: [123, 124, 125],  // PO가 생성한 Draft Task 번호
  tasksFile: "specs/5-comments/tasks.md",
  epic: 144
});

// 단독 실행
skill: complete-draft-task({
  draftIssues: [130],
  specFile: "specs/6-likes/spec.md"
});
```

## Process

### Phase 0: Projects 이슈관리 보드 확인 (필수)

> **🔴 선행 조건**: Draft Task 작업 전 반드시 Projects "이슈관리" 보드 연결 확인

```bash
# Issue의 Projects 연결 상태 확인
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        projectItems(first: 10) {
          nodes {
            project {
              title
              number
            }
          }
        }
      }
    }
  }
' -f owner="semicolon-devteam" -f repo="{repo}" -F number={issue_number}
```

**연결 상태 판단**:

| 상태 | 처리 |
|------|------|
| Projects 연결 없음 | ⚠️ 이슈관리 보드 연결 먼저 수행 |
| 다른 Project만 연결 | ⚠️ 이슈관리 보드 추가 연결 |
| 이슈관리 보드 연결됨 | ✅ Phase 1로 진행 |

**미연결 시 자동 연결**:

```bash
# Step 1: Project ID 조회 (이슈관리 보드 = #1)
PROJECT_ID=$(gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        id
      }
    }
  }
' --jq '.data.organization.projectV2.id')

# Step 2: Issue Node ID 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{repo}/issues/{issue_number} \
  --jq '.node_id')

# Step 3: Project에 Issue 추가
gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
' -f projectId="$PROJECT_ID" -f contentId="$ISSUE_NODE_ID"
```

**Phase 0 출력**:

```markdown
### 📋 Projects 이슈관리 보드 확인

| Issue | 이슈관리 보드 | 조치 |
|-------|-------------|------|
| #123 | ❌ 미연결 | ✅ 연결 완료 |
| #124 | ✅ 연결됨 | - |
```

### Phase 1: Draft Task 조회

- GitHub CLI로 Draft Task 정보 조회
- 현재 라벨, 본문, 메타데이터 확인

### Phase 2: spec.md 기반 AC 생성

- spec.md에서 해당 Task의 Acceptance Criteria 추출
- Markdown 체크리스트 형식으로 변환

### Phase 3: Issue 업데이트

각 Draft Task에 대해:

1. **draft 라벨 제거**: `gh issue edit --remove-label draft`
2. **본문 보강**: AC, Dependencies, Metadata 추가
3. **Epic 연결**: Sub-issue로 연결
4. **Estimation 추가**: Story Points 설정
5. **Assignee 설정**: 담당자 지정 (선택)

### Phase 4: 보고

- 변환 완료 Issue 목록
- 전후 비교 요약
- Epic 연결 상태

## Output Format

```markdown
## ✅ Draft Task 변환 완료

**Epic**: #144 - Add comment functionality
**변환된 Tasks**: 5개

### Before → After

| Issue | Before | After |
|-------|--------|-------|
| #145 | `draft`, 본문 없음 | `task`, AC 추가, Epic 연결 |
| #146 | `draft`, 본문 없음 | `task`, AC 추가, Epic 연결 |

### Updated Issues

- #145: [v0.0.x CONFIG] Check dependencies
  - Labels: `v0.0.x-config`, `domain:posts`, `task`
  - AC: 3 criteria added
  - Epic: #144

### Projects 이슈관리 보드

| Issue | 상태 |
|-------|------|
| #145 | ✅ 연결됨 |
| #146 | ✅ 연결됨 (자동 연결) |

### Next Steps

1. Project Board에서 Task 확인
2. Implementation 시작: `skill:implement`
```

## SAX Message

```markdown
[SAX] Skill: complete-draft-task 실행 - Epic #{epic}
```

## References

- [Workflow Details](references/workflow.md)
- [Issue Update Template](references/issue-template.md)

## Related

- [create-issues Skill](../create-issues/SKILL.md) - 이 Skill을 호출
- [spec Skill](../spec/SKILL.md) - spec.md 생성
- [draft-task-creator (SAX-PO)](../../sax-po/skills/draft-task-creator/SKILL.md) - Draft Task 생성
