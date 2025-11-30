# Workflow Reference

## 입력 스키마

epic-master로부터 전달받는 정보:

```yaml
domain_name: string      # 도메인명 (예: Comments)
domain_description: string
problems: string[]       # 해결하려는 문제
benefits: string[]       # 기대 효과
user_stories:
  required: string[]     # 필수 User Stories
  optional: string[]     # 선택 User Stories
acceptance_criteria: string[]
target_repos: string[]   # 대상 레포지토리
dependencies: string[]
priority: string         # High/Medium/Low
complexity: string       # High/Medium/Low
```

## 동작 상세

### 1. 템플릿 로드

```bash
# 템플릿 경로
.claude/sax-po/templates/epic-template.md
```

### 2. 템플릿 렌더링

입력 데이터로 템플릿의 플레이스홀더 치환

### 3. GitHub Issue 생성

```bash
gh issue create \
  --repo semicolon-devteam/docs \
  --title "[Epic] {DOMAIN_NAME} · {short_description}" \
  --body "{rendered_template}" \
  --label "epic"
```

### 4. Projects 연동 (필수)

```bash
# 1. Issue의 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/docs/issues/{issue_number} \
  --jq '.node_id')

# 2. 이슈관리 Projects (#1)에 추가
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
' -f projectId="PVT_kwDOCr2fqM4A0TQd" -f contentId="$ISSUE_NODE_ID"
```

> **Note**: `PVT_kwDOCr2fqM4A0TQd`는 semicolon-devteam의 `이슈관리` Projects (#1) ID입니다.

## 제약 사항

- docs 레포지토리에만 Epic 생성
- 기술 상세는 포함하지 않음
- **Projects 연동은 필수** (실패 시 재시도 필요)
