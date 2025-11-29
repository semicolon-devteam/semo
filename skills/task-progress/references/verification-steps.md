# Verification Steps

## 1. 업무할당 확인

```yaml
method: "issue_url_or_branch"
check:
  - 사용자가 이슈 URL 제공 (예: cm-office#32)
  - 또는 현재 브랜치명에서 이슈 번호 추출 (예: feature/32-add-comments)
result:
  - 이슈 번호 파싱
  - GitHub API로 이슈 존재 확인
  - 할당자(assignee) 확인
```

## 2. GitHub Project 상태 확인 (작업중)

```yaml
method: "gh_project_status"
command: "gh project item-list {project_number} --owner semicolon-devteam --format json"
check:
  - 해당 이슈의 status 필드 확인
  - "작업중" 상태인지 검증
auto_action:
  - status가 "검수완료"면 → "작업중"으로 자동 변경
  - gh project item-edit 명령 사용
```

## 3. Feature 브랜치 확인

```yaml
method: "git_branch"
command: "git branch --show-current"
check:
  - 브랜치명이 main/master가 아닌지
  - feature/* 패턴 또는 이슈 번호 포함 확인
auto_action:
  - 브랜치 없으면 → 생성 제안 및 자동 생성
  - "feature/{issue_number}-{title}" 형식
```

## 4. Draft PR 확인

```yaml
method: "gh_pr_list"
command: "gh pr list --head {current_branch} --json number,isDraft"
check:
  - 현재 브랜치의 PR 존재 여부
  - Draft 상태 확인
auto_action:
  - Draft PR 없으면 → 빈 커밋 + Draft PR 생성
  - 커밋 메시지: ":tada: #{issue_number} Draft PR생성을 위한 빈 커밋"
  - PR 제목: "[Draft] #{issue_number} {issue_title}"
```

## 5. Speckit 기반 구현

```yaml
spec:
  file: "specs/{domain}/spec.md"
  check: 파일 존재 여부
  auto_action: 없으면 spec-master Agent 호출

plan:
  file: "specs/{domain}/plan.md"
  check: 파일 존재 여부
  auto_action: 없으면 /speckit.plan 안내

tasks:
  file: "specs/{domain}/tasks.md"
  check: 파일 존재 여부
  auto_action: 없으면 /speckit.tasks 안내

tasks_github_sync:
  method: "tasks_md_check"
  check: tasks.md에 "## GitHub Issues" 섹션 및 링크 존재
  auto_action: 없으면 sync-tasks skill 호출 안내
```

## 6. 테스트코드 작성 확인

```yaml
method: "test_files_check"
command: "find . -type f -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts'"
check:
  - 테스트 파일 존재 여부
  - 최근 수정 시간 (Feature 브랜치 생성 이후)
auto_action:
  - 없으면 → 테스트 작성 안내
  - "implementation-master Agent에게 테스트 작성 요청하세요"
```

## 7. 린트 및 빌드 통과 확인

```yaml
lint:
  command: "npm run lint 2>&1"
  check: exit code 0
  auto_action: 실패 시 → 에러 수정 안내

typecheck:
  command: "npx tsc --noEmit 2>&1"
  check: exit code 0
  auto_action: 실패 시 → 타입 에러 수정 안내

build:
  command: "npm run build 2>&1"
  check: exit code 0 (선택, 개발 환경 이슈 예외)
  auto_action: 실패 시 → 빌드 에러 수정 안내
```

## 8. 푸시 및 리뷰 진행 확인

```yaml
push:
  command: "git log origin/{current_branch}..HEAD --oneline"
  check: 로컬 커밋이 원격에 푸시되었는지
  auto_action: 미푸시 커밋 있으면 → "git push" 안내

pr_ready:
  command: "gh pr view --json isDraft"
  check: Draft 상태가 false인지 (Ready for review)
  auto_action: Draft 상태면 → "gh pr ready" 안내
```

## 9. dev 머지 확인

```yaml
method: "gh_pr_merged"
command: "gh pr view --json mergedAt,baseRefName"
check:
  - PR이 머지되었는지 (mergedAt != null)
  - baseRefName이 "dev"인지
result:
  - 머지 완료 시 체크
```

## 10. GitHub Project 상태 변경 및 완료일 설정

```yaml
method: "gh_project_status_update"
workflow:
  # PR Ready 요청 시
  pr_ready:
    check: PR이 Draft → Ready로 변경되었는지
    auto_action:
      - status "작업중" → "리뷰요청" 자동 변경

  # dev 머지 완료 시
  dev_merge:
    check: PR이 dev 브랜치에 머지되었는지
    auto_action:
      - status "리뷰요청" → "테스트중" 자동 변경
      - 작업완료일 필드에 현재 날짜 설정

  # QA 테스트 통과 시
  qa_pass:
    check: SAX-QA에서 test-pass 처리되었는지
    auto_action:
      - status "테스트중" → "병합됨" 자동 변경
```

## GitHub Project 상태 조회

> **⚠️ SoT**: 상태 목록은 GitHub Project에서 직접 조회합니다.

```bash
# 상태 목록 조회
gh api graphql -f query='
  query {
    organization(login: "semicolon-devteam") {
      projectV2(number: 1) {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            options { name color }
          }
        }
      }
    }
  }
' --jq '.data.organization.projectV2.field.options[]'
```

> 📌 상세 API 워크플로우: [project-status.md](../../git-workflow/references/project-status.md) 참조
