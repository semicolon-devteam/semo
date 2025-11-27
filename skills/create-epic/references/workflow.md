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

### 4. Projects 연동

```bash
# 이슈를 프로젝트에 추가
gh project item-add {PROJECT_NUMBER} \
  --owner semicolon-devteam \
  --url {issue_url}

# 타입 필드를 "에픽"으로 설정
gh project item-edit \
  --project-id {PROJECT_ID} \
  --id {ITEM_ID} \
  --field-id {TYPE_FIELD_ID} \
  --single-select-option-id {EPIC_OPTION_ID}
```

## 제약 사항

- docs 레포지토리에만 Epic 생성
- 기술 상세는 포함하지 않음
- Projects 연동은 선택적 (실패해도 Epic은 생성됨)
