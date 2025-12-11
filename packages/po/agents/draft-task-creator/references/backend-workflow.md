# Backend Draft Task Workflow

## 🔴 레포지토리 라우팅 (NON-NEGOTIABLE)

> **Backend 작업은 예외 없이 `semicolon-devteam/core-backend`에 생성합니다.**

| 키워드 | 대상 레포 | 변경 가능 |
|--------|----------|----------|
| API, 서버, 데이터베이스, RPC, 엔드포인트 | `core-backend` | ❌ 불가 |

⚠️ Epic의 "대상 레포" 필드와 관계없이 Backend 작업은 **무조건** core-backend입니다.

## 1. Duplication Check (필수 - 스킵 금지)

```markdown
[SAX] Skill: check-backend-duplication 호출 - Epic #{epic_number}
```

**🔴 이 단계는 반드시 실행해야 합니다. 스킵 시 Issue #13 위반.**

Check core-backend domain + Service level for duplicates.

**If duplicate found**:
```markdown
### ⚠️ core-backend 중복 확인

**도메인**: {domain}
**기존 구현**: {existing_function}
**파일**: {file_path}

**권장 사항**:
- core-backend Task는 생성하지 않습니다.
- 프론트엔드에서 기존 API 활용
```

→ Add comment to Epic, **SKIP** core-backend Task

## 2. Create Backend Task (if no duplicate)

```bash
gh api repos/semicolon-devteam/core-backend/issues \
  -f title="[Backend] {task_title}" \
  -f body="{task_body}"
```

## Task Body Structure

```markdown
# [Backend] {task_title}

## 📌 작업 개요

{Epic에서 추출한 백엔드 작업 설명}

## ✅ Acceptance Criteria

[SAX] Skill: generate-acceptance-criteria 사용

- [ ] {criterion_1}
- [ ] {criterion_2}
- [ ] 테스트 코드 작성 완료
- [ ] 린트 체크 통과

## 📊 Estimation

[SAX] Skill: assign-estimation-point 사용

- [x] API 엔드포인트 구현 (3점)
- [x] 비즈니스 로직 구현 (5점)

**Point**: 8점

## 🌿 Branch

`feature/{epic-number}-{domain}-backend`

## 🔗 Related Epic

Closes semicolon-devteam/docs#{epic_number}
```

## 3. Link Sub-issue

```bash
# Add to Epic body:
# - [ ] semicolon-devteam/core-backend#123
```

## 4. Apply draft Label

```bash
gh api repos/semicolon-devteam/core-backend/issues/{issue_number}/labels \
  -f labels[]="draft"
```

## 5. Add to GitHub Projects (필수)

생성된 Issue를 `이슈관리` Projects (#1)에 등록:

```bash
# 1. Issue의 node_id 조회
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/core-backend/issues/{issue_number} \
  --jq '.node_id')

# 2. Projects에 추가
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
