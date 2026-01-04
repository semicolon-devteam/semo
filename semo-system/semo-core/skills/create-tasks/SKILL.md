---
name: create-tasks
description: |
  Epic Issue에서 Task Issue 생성. Use when (1) ideate/create-epic 완료 후,
  (2) Epic을 Task로 분해 필요, (3) "태스크 만들어줘", (4) Task Issue 기반 Speckit 워크플로우.
tools: [Bash, Read, Write, GitHub CLI]
location: project
triggers:
  - 태스크 만들어줘
  - 태스크 만들어
  - task 생성
  - task 만들어
  - 이슈 만들어줘
  - 이슈 생성해줘
---

> **시스템 메시지**: `[SEMO] Skill: create-tasks 호출 - Epic #{epic_number}`

# create-tasks Skill

**Purpose**: Epic Issue를 DDD Layer 기반으로 Task Issue로 분해하고 선별적 정보 위임

## 핵심 원칙

> **Source of Truth**: Task Issue가 Speckit 워크플로우의 진실 소스
> **정보 위임**: Epic의 정보를 Layer별로 선별하여 Task에 위임
> **Speckit 체크리스트**: Task에 포함, generate-spec 실행 시 자동 업데이트

## Quick Start

### Input

- Epic Issue 번호 (필수)
- 프로젝트 라벨 (선택, Epic에서 상속)

### Process

```text
1. Epic Issue 본문 파싱
     ↓
2. DDD Layer 기반 Task 분해
     ↓
3. Layer별 정보 선별 위임
     ↓
4. Task Issue 생성 (Speckit 체크리스트 포함)
     ↓
5. Projects 연동 + Issue Type 설정
```

### Output

- Task Issues (Speckit 체크리스트 포함)
- Projects에 등록된 Task
- 요약 리포트

## Workflow

### Phase 1: Epic Issue 파싱

```bash
# Epic 본문 조회
EPIC_BODY=$(gh issue view $EPIC_NUMBER --repo semicolon-devteam/docs --json body --jq '.body')
EPIC_TITLE=$(gh issue view $EPIC_NUMBER --repo semicolon-devteam/docs --json title --jq '.title')
EPIC_LABELS=$(gh issue view $EPIC_NUMBER --repo semicolon-devteam/docs --json labels --jq '[.labels[].name] | join(",")')
```

**Epic에서 추출할 정보**:

| 섹션 | 추출 내용 |
|------|----------|
| Problem Statement | 현재 상황, 문제점, 영향 |
| Goals | Primary, Secondary, Non-goals |
| User Scenarios | 사용자 액션 → 시스템 응답 → 결과 |
| Constraints | 기술적, 비즈니스, 사용자 제약 |
| Success Metrics | 측정 가능한 지표 |

### Phase 2: DDD Layer 기반 Task 분해

> **Layer 순서**: CONFIG → PROJECT → DATA → TESTS → CODE

| Layer | 버전 | 설명 | 예시 Task |
|-------|------|------|----------|
| CONFIG | v0.1.x | 환경 설정, 의존성 | 패키지 설치, 환경변수 |
| PROJECT | v0.2.x | 프로젝트 구조 | 폴더 구조, 라우팅 |
| DATA | v0.3.x | 데이터 스키마, API | DB 스키마, API 엔드포인트 |
| TESTS | v0.4.x | 테스트 작성 | 유닛 테스트, E2E |
| CODE | v0.5.x | 비즈니스 로직 | UI 컴포넌트, 핵심 기능 |

### Phase 3: 정보 선별 위임

> **Layer별로 관련된 정보만 Task에 위임**

| Layer | 위임할 Dev Checklist | 위임할 Constraints |
|-------|---------------------|-------------------|
| CONFIG | - | 기술적.의존성 |
| PROJECT | - | 기술적.아키텍처 |
| DATA | 데이터 흐름, 시간/계산 | 기술적.데이터 |
| TESTS | 엣지 케이스 | - |
| CODE | 플랫폼 제약, 도메인 지식 | 기술적.플랫폼 |

### Phase 4: Task Issue 생성

**Task Issue 본문 템플릿**:

```markdown
## 📋 {task_description}

## 🔄 Speckit Progress
<!-- generate-spec 실행 시 자동 업데이트 -->
- [ ] specify → spec.md
- [ ] plan → plan.md
- [ ] implement

## 🎯 Problem Context
<!-- Epic에서 위임 (이 Task 관련 부분만) -->
{Epic Problem Statement에서 관련 부분}

## 🎯 Goals
<!-- 이 Task에 관련된 목표만 -->
- {관련 Primary Goal}

## 👤 User Scenario
<!-- 이 Task가 담당하는 시나리오 -->
| Step | 사용자 액션 | 이 Task의 역할 |
|------|------------|---------------|
| {N} | {액션} | {역할} |

## ⚠️ Constraints
<!-- Layer별 관련 제약만 위임 -->
### 기술적 제약
- {이 Layer 관련 제약}

### 개발자 체크리스트
<!-- Layer별 관련 카테고리만 -->
- [ ] {해당 카테고리 항목}

## 🎯 Acceptance Criteria
- [ ] {AC 1}
- [ ] {AC 2}

## 🧪 테스트 요구사항
### 엔지니어 테스트
- [ ] {테스트 케이스}: {예상 결과}

### QA 테스트
| Step | Action | Expected |
|------|--------|----------|
| 1 | {동작} | {결과} |

## 🔗 Dependencies
- Depends on: #{issue}
- Blocks: #{issue}

## 📊 Metadata
| Field | Value |
|-------|-------|
| Layer | {v0.x.x LAYER} |
| Domain | {domain} |
| Epic | #{epic_number} |
```

### Phase 5: GitHub 연동

```bash
# 1. Task Issue 생성
TASK_NUMBER=$(gh issue create \
  --repo semicolon-devteam/{project_repo} \
  --title "[v0.1.x CONFIG] {task_title}" \
  --body "$TASK_BODY" \
  --label "{project_label}" \
  | grep -oE '[0-9]+$')

# 2. Projects에 추가
ISSUE_NODE_ID=$(gh api repos/semicolon-devteam/{project_repo}/issues/$TASK_NUMBER \
  --jq '.node_id')

ITEM_ID=$(gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
      item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" -f contentId="$ISSUE_NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')

# 3. Issue Type을 Task로 설정
gh api graphql -f query='
  mutation {
    updateIssue(input: {
      id: "'"$ISSUE_NODE_ID"'"
      issueTypeId: "IT_kwDOC01-Rc4BdOub"
    }) {
      issue { id title }
    }
  }
'

# 4. Status를 "검수대기"로 설정
STATUS_RESULT=$(gh api graphql -f query='
query {
  organization(login: "semicolon-devteam") {
    projectV2(number: 1) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          id
          options { id name }
        }
      }
    }
  }
}')

STATUS_FIELD_ID=$(echo "$STATUS_RESULT" | jq -r '.data.organization.projectV2.field.id')
STATUS_OPTION_ID=$(echo "$STATUS_RESULT" | jq -r '.data.organization.projectV2.field.options[] | select(.name == "검수대기") | .id')

gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="PVT_kwDOC01-Rc4AtDz2" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$STATUS_FIELD_ID" \
  -f optionId="$STATUS_OPTION_ID"
```

### Phase 6: Report

```markdown
[SEMO] Skill: create-tasks 완료

## 📋 Task 생성 결과

### Epic
- 번호: #{epic_number}
- 제목: {epic_title}

### 생성된 Tasks

| Layer | Task | Issue |
|-------|------|-------|
| v0.1.x CONFIG | {task_1} | #{issue_1} |
| v0.2.x PROJECT | {task_2} | #{issue_2} |
| v0.3.x DATA | {task_3} | #{issue_3} |
| v0.5.x CODE | {task_4} | #{issue_4} |

### Speckit 상태
모든 Task에 Speckit 체크리스트 포함:
- [ ] specify → spec.md
- [ ] plan → plan.md
- [ ] implement

### 다음 단계
1. **Spec 작성**: "spec 작성해줘" 또는 `skill:generate-spec --task #{task_number}`
2. **구현 시작**: Task별 Speckit 완료 후 구현
```

## Issue Title Format

```text
[v0.1.x CONFIG] Set up project dependencies
[v0.2.x PROJECT] Create folder structure for comments
[v0.3.x DATA] Define comment schema and API
[v0.5.x CODE] Implement comment UI components
```

## Issue Type ID Reference

| Type | ID | 사용 시점 |
|------|-----|----------|
| Task | `IT_kwDOC01-Rc4BdOub` | 일반 태스크 (기본값) |
| Bug | `IT_kwDOC01-Rc4BdOuc` | 버그 리포트 |
| Feature | `IT_kwDOC01-Rc4BdOud` | 기능 요청 |
| Epic | `IT_kwDOC01-Rc4BvVz5` | 에픽 생성 시 |

## Related

- `ideate` - 아이디어 → Epic (이 스킬 이전 단계)
- `create-epic` - Epic Issue 생성
- `generate-spec` - Speckit 문서 생성 + Task 업데이트 (이 스킬 이후 단계)
- `implement` - 구현 단계

## References

- [Layer Delegation](references/layer-delegation.md) - Layer별 정보 위임 상세
- [Naming Conventions](references/naming-conventions.md) - Label and title standards
- [Dependency Handling](references/dependency-handling.md) - Dependency chain management
