# Branch Strategy

## Branch Creation

**형식**: `{issue-number}-{feature-name}`

```bash
# 이슈 번호 기반 브랜치 생성
create_feature_branch() {
  ISSUE_NUM=$1
  FEATURE_NAME=$2
  git checkout -b "${ISSUE_NUM}-${FEATURE_NAME}"
}

# 예시
git checkout -b "42-user-profile-edit"
git checkout -b "001-dynamic-gnb-menus"
```

## Branch Naming Rules

| 유형 | 패턴 | 예시 |
|------|------|------|
| Feature | `{issue}-{feature}` | `35-comment-ui` |
| Fix | `fix/{issue}-{description}` | `fix/42-login-redirect` |
| Hotfix | `hotfix/{issue}-{description}` | `hotfix/99-critical-bug` |

## Issue Onboarding Workflow

**Purpose**: GitHub Issue URL을 받아 브랜치 생성부터 Speckit 가이드까지 안내

```bash
# Step 1: Issue URL에서 정보 추출
# URL: https://github.com/semicolon-devteam/cm-office/issues/132
ORG="semicolon-devteam"
REPO="cm-office"
ISSUE_NUM="132"

# Step 2: Issue 제목 조회 (gh cli)
ISSUE_TITLE=$(gh issue view $ISSUE_NUM --repo $ORG/$REPO --json title -q '.title')
# 예: "User Profile Upload"

# Step 3: 브랜치명 생성 (slug 변환)
BRANCH_NAME="${ISSUE_NUM}-$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')"
# 예: "132-user-profile-upload"

# Step 4: dev 브랜치 확인 및 최신화
git checkout dev
git pull origin dev

# Step 5: 피처 브랜치 생성
git checkout -b "$BRANCH_NAME"
```

## Issue Onboarding Response Template

```markdown
## 🚀 Issue Onboarding: #{issue_number}

**이슈 정보**:
- Repository: `{repo}`
- Issue: #{issue_number}
- Title: `{issue_title}`

---

### ✅ Step 1: 브랜치 확인

현재 브랜치: `{current_branch}`

{if current != dev}
⚠️ `dev` 브랜치가 아닙니다. 먼저 이동합니다:
```bash
git checkout dev
```
{/if}

---

### ✅ Step 2: 소스 최신화

```bash
git pull origin dev
```

---

### ✅ Step 3: 피처 브랜치 생성

```bash
git checkout -b {issue_num}-{title_slug}
```

---

### 🎯 Step 4: 다음 단계

브랜치가 생성되었습니다! 이제 Speckit 워크플로우를 시작하세요:

1. **명세 작성**: `/speckit.specify`
2. **계획 수립**: `/speckit.plan`
3. **태스크 분해**: `/speckit.tasks`
4. **구현**: `/speckit.implement`

**권장**: `/speckit.specify` 실행하여 spec.md 생성
```

## Auto-Execute Option

사용자가 "진행해줘" 또는 "Y"로 응답하면 자동 실행:

```bash
# 자동 실행 시퀀스
git checkout dev && \
git pull origin dev && \
git checkout -b "${ISSUE_NUM}-${TITLE_SLUG}"
```
