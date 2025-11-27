# Epic 이식 워크플로우 (Workflow B)

## Phase 1: 원본 Epic 읽기

```bash
# 원본 Epic 조회
gh api repos/{source_org}/{source_repo}/issues/{epic_number}
```

## Phase 2: 프로젝트 감지

```markdown
[SAX] Skill: detect-project-from-epic 사용
```

## Phase 3: Epic 내용 복사 및 이식

**이식 Epic 본문 구조**:
```markdown
# [이식] {original_title}

> ⚠️ **이식된 Epic**: {source_repo}#{epic_number}에서 이식됨
> **원본 Epic**: {original_epic_url}

{original_epic_body}

## 🔗 관련 이슈

- 원본 Epic: {source_org}/{source_repo}#{epic_number}
```

```markdown
[SAX] Skill: create-epic 사용 (이식 모드)
```

## Phase 4: 프로젝트 라벨 적용

감지된 프로젝트 또는 수동 선택:

```markdown
[SAX] Skill: assign-project-label 사용
```

## Phase 5: 원본 Epic 표시

```bash
# 원본 Epic에 코멘트 추가
gh api repos/{source_org}/{source_repo}/issues/{epic_number}/comments \
  -f body="✅ **Epic 이식 완료**

이 Epic은 docs 레포로 이식되었습니다.

**새 Epic**: semicolon-devteam/docs#{new_epic_number}
**이식 일시**: {migration_date}

앞으로의 작업은 새 Epic에서 진행됩니다."

# 원본 Epic에 migrated 라벨 추가
gh api repos/{source_org}/{source_repo}/issues/{epic_number}/labels \
  -f labels[]="migrated"
```

## 출력 형식

```markdown
[SAX] Skill: detect-project-from-epic 사용

[SAX] Skill: create-epic 사용 (이식 모드)

[SAX] Skill: assign-project-label 사용

## ✅ Epic 이식 완료

**원본 Epic**: {source_repo}#{original_epic_number}
**새 Epic**: docs#{new_epic_number}
**이슈 URL**: {new_epic_url}
**프로젝트**: {project_name}
**GitHub Projects**: #1 이슈관리 보드에 추가됨

### 다음 단계

1. **Draft Task 생성**:
   > "Draft Task 생성해줘"

2. **개발자에게 전달**:
   - 할당된 Draft Task 확인
   - 대상 레포에서 `/speckit.specify` 실행
```
