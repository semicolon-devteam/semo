# Branch Strategy Reference

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
        └── {issue-number}-{feature-name} ────────────────────→
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

---

## Branch Naming

**Format**: `{issue-number}-{feature-name}` or `fix/{issue-number}-{description}`

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `{issue}-{feature}` | `35-post-api` |
| Fix | `fix/{issue}-{description}` | `fix/42-null-pointer` |

## Rules

- main/master 직접 작업 금지
- Feature Branch에서만 작업
- 브랜치당 1개 이슈

## Commands

```bash
# 브랜치 생성
git checkout -b 35-post-api

# 원격에 푸시
git push -u origin 35-post-api
```

## Issue Number Extraction

```bash
# 현재 브랜치에서 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
echo $ISSUE_NUM  # 35
```
