# Epic 생성 워크플로우 (Workflow A)

## Phase 1: 요구사항 수집

Ask user:

```markdown
## 🤔 기능 정의를 위한 질문

다음 질문에 답해주시면 Epic을 작성해드릴게요:

1. **도메인명**: 이 기능의 이름은 무엇인가요? (예: Comments, Points, Auth)
2. **해결할 문제**: 사용자가 겪는 문제는 무엇인가요?
3. **기대 효과**: 이 기능으로 무엇을 달성하고 싶으신가요?
4. **대상 사용자**: 누가 이 기능을 사용하나요?
5. **주요 기능**: 사용자가 할 수 있어야 하는 것들을 나열해주세요
6. **관련 레포**: 어떤 레포지토리에 구현되나요? (cm-template, cm-office 등)
7. **디자인 필요 여부**: 이 기능에 디자인 작업이 필요한가요? (예/아니오)
```

**디자인 작업 필요 시 추가 질문**:
```markdown
8. **디자인 범위**: 어떤 화면/컴포넌트에 디자인이 필요한가요?
9. **Figma 링크**: 기존 디자인이 있다면 링크를 공유해주세요 (선택)
10. **디자인 완료 기한**: 디자인 작업의 완료 기한이 있나요? (선택)
```

## Phase 2: Epic 작성

Use collected information to create Epic:

```markdown
[SAX] Skill: create-epic 사용
```

## Phase 3: 프로젝트 라벨 및 Projects 연결

```markdown
[SAX] Skill: assign-project-label 사용
```

## Phase 4: Spec 초안 생성 (선택)

```markdown
[SAX] Agent: spec-writer 위임 (사유: Spec 초안 생성)
```

## Epic 구조

```markdown
## 📌 Epic 개요

{domain_description}

## 🎯 비즈니스 목표

- **해결하려는 문제**: {problems}
- **기대 효과**: {benefits}

## 👥 사용자 스토리 (User Stories)

### 필수 기능

- [ ] 사용자는 {action1}을 할 수 있다
- [ ] 사용자는 {action2}을 할 수 있다

### 추가 기능 (선택)

- [ ] 사용자는 {optional_action}을 할 수 있다

## ✅ 완료 조건 (Acceptance Criteria)

- [ ] {criterion1}
- [ ] {criterion2}

## 🔗 관련 정보

### 📦 대상 레포지토리

- [ ] {target_repo}

### 🔄 의존성

- 선행 요구사항: {dependencies}
- 후속 Epic: {followup}
```

## 출력 형식

```markdown
[SAX] Skill: create-epic 사용

[SAX] Skill: assign-project-label 사용

## ✅ Epic 생성 완료

**이슈 번호**: #{issue_number}
**이슈 URL**: {issue_url}
**도메인**: {domain_name}
**프로젝트**: {project_name}
**GitHub Projects**: #1 이슈관리 보드에 추가됨

### 다음 단계

1. **Spec 초안 생성** (선택):
   > "Spec 초안도 작성해줘"

2. **개발자에게 전달**:
   - 개발자가 대상 레포에서 `/speckit.specify` 실행
   - Epic의 User Stories를 기반으로 spec.md 보완

3. **진행도 확인**:
   - GitHub Projects에서 Epic 상태 확인
```
