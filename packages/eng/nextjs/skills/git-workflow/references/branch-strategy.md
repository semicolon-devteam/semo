# Branch Strategy

> **SoT 참조**: 브랜치 전략은 `semo-core/TEAM_RULES.md` 섹션 1.1에서 관리됩니다.

## 🔴 Spec-First Branching Rule (필수)

> **핵심 원칙**: Spec은 dev 브랜치에서 작성 → 원격 푸시 → Feature 브랜치 생성

### 워크플로우 다이어그램

```text
dev 브랜치 ─────────────────────────────────────────────────────→
    │
    ├── [SDD Phase 1-3] Spec 작성
    │   └── specs/{domain}/spec.md, plan.md, tasks.md
    │
    ├── 커밋: 📝 #{이슈번호} Add spec for {도메인}
    │
    ├── git push origin dev (원격 공유)
    │
    └── Feature 브랜치 분기
        │
        └── {issue_number}-{title} ─────────────────────────────→
            │
            ├── [ADD Phase 4] 코드 구현
            │
            └── Draft PR → Ready → Merge
```

### 브랜치별 허용 작업

| 브랜치 | 허용 작업 | 금지 작업 |
|--------|----------|----------|
| `dev` | Spec 작성, 설정 변경 | 기능 코드 구현 |
| `feature/*` | 코드 구현, 테스트 | Spec 신규 작성 (수정은 허용) |
| `main` | 릴리스 머지만 | 직접 작업 금지 |

### 목적

- **Spec 공유**: 다른 작업자도 특정 도메인의 Spec을 공유받을 수 있음
- **일관성**: Feature 브랜치 시작 시 항상 최신 Spec 포함
- **협업**: 동일 도메인 작업 시 순차 작업 권장 (Spec 충돌 방지)

---

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

### ✅ Step 3: Spec 작성 (dev 브랜치에서)

> ⚠️ Feature 브랜치 생성 전 dev에서 Spec 먼저 작성

```bash
# dev 브랜치에서 Spec 작성
/speckit.specify → specs/{domain}/spec.md
/speckit.plan    → specs/{domain}/plan.md
/speckit.tasks   → specs/{domain}/tasks.md

# Spec 커밋 및 푸시
git add specs/{domain}/
git commit -m "📝 #{issue_num} Add spec for {domain}"
git push origin dev
```

---

### ✅ Step 4: 피처 브랜치 생성

```bash
git checkout -b {issue_num}-{title_slug}
```

---

### 🎯 Step 5: 코드 구현

Feature 브랜치에서 실제 코드 구현:

1. **코드 구현**: `skill:implement` (ADD Phase 4)
2. **테스트 작성**: 테스트코드 작성
3. **린트/빌드**: `npm run lint && npx tsc --noEmit`
4. **PR Ready**: `gh pr ready`

> 📌 Spec은 이미 dev에서 완료됨. Feature 브랜치에서는 코드만 구현.
```

## Auto-Execute Option

사용자가 "진행해줘" 또는 "Y"로 응답하면 자동 실행:

```bash
# 자동 실행 시퀀스
git checkout dev && \
git pull origin dev && \
git checkout -b "${ISSUE_NUM}-${TITLE_SLUG}"
```
