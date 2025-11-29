---
name: task-progress
description: 개발자 워크플로우 진행도 확인 및 자동화
---

# /SAX:task-progress Command

개발자의 10단계 워크플로우 진행도를 확인하고 자동화 가능한 작업을 제안합니다.

## Trigger

- `/SAX:task-progress` 명령어
- "어디까지 했어", "진행 상황", "현황" 키워드
- orchestrator가 업무 시작 시 자동 호출

## Action

`skill:task-progress`를 실행하여:

1. 현재 작업 중인 이슈 확인 (~/.claude.json에서 currentTask 조회)
2. 10단계 체크리스트 표시
3. 자동화 가능한 작업 제안 및 실행

## 10-Step Developer Workflow

```text
1. 업무할당 (검수대기 → 검수완료)
2. GitHub Project 상태 변경 (검수완료 → 작업중)
3. Feature 브랜치 생성
4. Draft PR 생성
5. Speckit 기반 구현 (Spec → Plan → Tasks)
6. 테스트코드 작성 및 테스트 진행
7. 린트 및 빌드 통과
8. 푸시 및 리뷰 요청 (작업중 → 리뷰요청)
9. PR 승인 및 dev 머지 (리뷰요청 → 테스트중)
10. STG 환경 QA 테스트 (테스트중 → 병합됨)
```

### GitHub Project 상태 조회

> **⚠️ SoT**: 상태 목록은 GitHub Project에서 직접 조회합니다.

```bash
gh api graphql -f query='query { organization(login: "semicolon-devteam") { projectV2(number: 1) { field(name: "Status") { ... on ProjectV2SingleSelectField { options { name color } } } } } }' --jq '.data.organization.projectV2.field.options[]'
```

> 📌 상세: [project-status.md](../../skills/git-workflow/references/project-status.md)

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 진행도 확인

[SAX] Skill: task-progress 사용

=== 작업 진행도 (cm-office#32: 댓글 기능 추가) ===

- [x] 업무할당 (cm-office#32)
- [x] GitHub Project 상태: 작업중
- [x] Feature 브랜치 (feature/32-add-comments)
- [ ] Draft PR 생성
- [ ] Spec 작성
- [ ] Plan 작성
- [ ] Tasks 작성
- [ ] 테스트 작성
- [ ] 린트/빌드 통과
- [ ] 리뷰 완료 및 dev 머지
- [ ] 상태 변경 → 리뷰요청

=== 다음 단계 ===
📝 Draft PR을 자동 생성하시겠습니까?

=== 자동화 가능 작업 ===
💡 다음 작업을 자동으로 수행할 수 있습니다:
- Draft PR 자동 생성 (빈 커밋 + push + gh pr create --draft)
- GitHub Project 상태 변경
- 작업완료일 설정
```

## Automation Examples

### Draft PR 자동 생성

```bash
git commit --allow-empty -m ":tada: #32 Draft PR생성을 위한 빈 커밋"
git push -u origin feature/32-add-comments
gh pr create --draft --title "[Draft] #32 댓글 기능 추가" --body "작업 진행 중..."
```

### GitHub Project 상태 변경

```bash
# 검수완료 → 작업중
gh project item-edit --id {item_id} --field-id {status_field_id} --project-id {project_id} --text "작업중"

# 작업중 → 리뷰요청
gh project item-edit --id {item_id} --field-id {status_field_id} --project-id {project_id} --text "리뷰요청"
```

## Related

- [task-progress Skill](../../skills/task-progress/SKILL.md)
- [SAX Core PRINCIPLES.md](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
