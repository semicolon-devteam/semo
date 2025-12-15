# Examples & Edge Cases

> orchestrator Agent의 라우팅 예시 및 엣지 케이스 처리

## Example 1: 명세 시작 전

```markdown
User: 이제 뭐 하면 돼?

## 📍 현재 진행 상황

**브랜치**: `001-dynamic-gnb-menus`
**이슈**: #001
**현재 Phase**: SDD Phase 1 (Specification)

### ✅ 완료된 작업

- [x] 브랜치 생성

### 📋 남은 작업

- [ ] spec.md 작성
- [ ] plan.md 작성
- [ ] tasks.md 작성
- [ ] 구현

---

## 🎯 다음 단계

**권장 작업**: 기능 명세서(spec.md) 작성

**사용할 에이전트/스킬**: `spec-master` 또는 `/speckit.specify`

**실행 방법**:

> /speckit.specify

또는 자연어로:

> "Dynamic GNB Menus 기능 명세 작성해줘"
```

## Example 2: 구현 중간

```markdown
User: 다음에 뭐 해야 해?

## 📍 현재 진행 상황

**브랜치**: `35-comment-ui`
**이슈**: #35
**현재 Phase**: ADD Phase 4 (Implementation) - v0.2.x TESTS

### ✅ 완료된 작업

- [x] spec.md 작성
- [x] plan.md 작성
- [x] tasks.md 작성
- [x] v0.0.x CONFIG
- [x] v0.1.x PROJECT (도메인 디렉토리 생성)

### 🔄 진행 중

- [ ] v0.2.x TESTS (CommentRepository 테스트 작성 중)

### 📋 남은 작업

- [ ] v0.3.x DATA
- [ ] v0.4.x CODE
- [ ] 검증 및 PR

---

## 🎯 다음 단계

**권장 작업**: CommentRepository 테스트 완료 후 Hooks 테스트 작성

**사용할 에이전트/스킬**: `implementation-master`

**실행 방법**:

> "v0.2.x 테스트 작성 계속해줘"
```

## Example 3: 구현 완료 후

```markdown
User: 이제 뭐 하면 돼?

## 📍 현재 진행 상황

**브랜치**: `35-comment-ui`
**이슈**: #35
**현재 Phase**: Verification (Phase 5)

### ✅ 완료된 작업

- [x] SDD Phase 1-3 (spec, plan, tasks)
- [x] ADD Phase 4 (v0.0.x ~ v0.4.x)
- [x] 모든 테스트 통과

### 📋 남은 작업

- [ ] 최종 검증
- [ ] PR 생성

---

## 🎯 다음 단계

**권장 작업**: 최종 검증 후 PR 생성

**사용할 에이전트/스킬**: `quality-master` → `skill:git-workflow`

**실행 방법**:

1. 먼저 검증:

   > "검증해줘" 또는 `skill:verify`

2. 검증 통과 후 PR 생성:
   > "PR 만들어줘"
```

## Issue URL Onboarding Flow

### Detection Pattern

사용자가 GitHub Issue URL과 함께 "할당받았는데", "시작하려는데", "뭐부터" 등의 키워드를 사용하면 Issue Onboarding 플로우를 시작합니다.

**URL Pattern**: `https://github.com/{org}/{repo}/issues/{number}`

**Extract Info**:

```bash
# URL에서 정보 추출
ORG="semicolon-devteam"  # 또는 URL에서 추출
REPO="cm-office"         # URL에서 추출
ISSUE_NUM="132"          # URL에서 추출
```

### Onboarding Workflow

```text
Issue URL 감지
     │
     ▼
┌─────────────────────┐
│ Step 1: 브랜치 확인  │
│ (현재 dev인지?)      │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  dev 아님     dev임
     │           │
     ▼           ▼
 "먼저 dev로   git pull
  이동하세요"   origin dev
                 │
                 ▼
┌─────────────────────┐
│ Step 2: 브랜치 생성  │
│ {issue}-{title-slug}│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Step 3: Speckit     │
│ 가이드 제공         │
└─────────────────────┘
```

### Example: Issue Onboarding

```markdown
User: https://github.com/semicolon-devteam/cm-office/issues/132 이거 할당받았는데, 뭐부터 하면 돼?

## 🚀 Issue Onboarding: #132

**이슈 정보**:

- Repository: `cm-office`
- Issue: #132
- Title: `User Profile Upload` (gh api로 조회)

---

### Step 1: 현재 브랜치 확인

현재 브랜치가 `dev`인지 확인합니다.

\`\`\`bash
git branch --show-current
\`\`\`

⚠️ `dev`가 아니면 먼저 이동:
\`\`\`bash
git checkout dev
\`\`\`

---

### Step 2: 소스 최신화

\`\`\`bash
git pull origin dev
\`\`\`

---

### Step 3: 피처 브랜치 생성

\`\`\`bash
git checkout -b 132-user-profile-upload
\`\`\`

---

### Step 4: Speckit 워크플로우 시작

브랜치가 생성되면 SDD 워크플로우를 시작합니다:

1. **명세 작성**: `/speckit.specify`
2. **계획 수립**: `/speckit.plan`
3. **태스크 분해**: `/speckit.tasks`
4. **구현**: `/speckit.implement`

---

**다음 단계**: 브랜치 생성 후 `/speckit.specify` 실행

진행할까요? (Y/n)
```

### Integration with git-workflow Skill

Issue Onboarding 시 `skill:git-workflow`의 `issue-onboarding` 기능을 호출합니다:

```markdown
**권장 작업**: 피처 브랜치 생성 및 Speckit 시작

**사용할 스킬**: `skill:git-workflow` (issue-onboarding 모드)

**실행 방법**:

> "132번 이슈로 브랜치 만들어줘" 또는 자동 진행
```

## Edge Cases

### No Active Feature Branch

```markdown
⚠️ 현재 `dev` 또는 `main` 브랜치에 있습니다.

**권장 작업**:

1. 작업할 이슈 확인 (command-center)
2. 피처 브랜치 생성: `git checkout -b {issue}-{feature-name}`

**예시**:

\`\`\`bash
git checkout -b 42-user-profile-edit
\`\`\`
```

### Multiple Incomplete Tasks

```markdown
⚠️ 여러 작업이 진행 중입니다.

**진행 중인 브랜치**:

1. `35-comment-ui` - v0.2.x TESTS
2. `42-profile-edit` - spec.md 작성 중

**권장**: 하나의 작업을 완료한 후 다음 작업 진행

현재 브랜치(`{current}`)의 작업을 먼저 완료하시겠어요?
```

### Technical Uncertainty

```markdown
💡 기술적 불확실성이 감지되었습니다.

**상황**: {uncertainty_description}

**권장 작업**: 스파이크(Spike) 진행

**사용할 에이전트**: `spike-master`

**실행 방법**:

> "{option1}와 {option2} 중 뭐가 좋을지 스파이크 해줘"
```
