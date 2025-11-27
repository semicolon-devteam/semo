# Frontend Draft Task Workflow

## 1. Create Frontend Task

```bash
# Example: cm-introduction-new
gh api repos/semicolon-devteam/{service_repo}/issues \
  -f title="[Frontend] {task_title}" \
  -f body="{task_body}"
```

## Task Body Structure

```markdown
# [Frontend] {task_title}

## 📌 작업 개요

{Epic에서 추출한 프론트 작업 설명}

## ✅ Acceptance Criteria

[SAX] Skill: generate-acceptance-criteria 사용

- [ ] {criterion_1}
- [ ] UI 컴포넌트 구현 완료
- [ ] API 연동 완료
- [ ] 테스트 코드 작성
- [ ] 린트 및 타입 체크 통과

## 📊 Estimation

[SAX] Skill: assign-estimation-point 사용

- [x] organisms UI 컴포넌트 (3점)
- [x] 기본 Form 작업 (5점)
- [x] API 연동 (2점)

**Point**: 10점

## 🌿 Branch

`feature/{epic-number}-{domain}-frontend`

## 🔗 Related Epic

Closes semicolon-devteam/docs#{epic_number}
```

## 2. Link Sub-issue

```bash
# Add to Epic body:
# - [ ] semicolon-devteam/{service_repo}#456
```

## 3. Apply draft Label

```bash
gh api repos/semicolon-devteam/{service_repo}/issues/{issue_number}/labels \
  -f labels[]="draft"
```
