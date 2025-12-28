# Atomic Commit Strategy

> implementation-master Agent의 자동 중간 커밋 전략

## 🔴 CRITICAL: 최소 단위 커밋

**커밋 단위 원칙**:
- **1 파일 = 1 커밋** (가능한 경우)
- **1 기능 단위 = 1 커밋** (관련 파일이 2-3개일 때)
- **NEVER**: 한 커밋에 5개 이상 파일 변경 금지

## Phase별 커밋 예시

```bash
# v0.1.x: PROJECT - 디렉토리/파일별 커밋
git commit -m "chore(v0.1.x): Create posts domain directory structure"
git commit -m "chore(v0.1.x): Add posts repository index.ts"
git commit -m "chore(v0.1.x): Add posts hooks index.ts"

# v0.2.x: TESTS - 테스트 파일별 커밋
git commit -m "test(v0.2.x): Add PostsRepository unit tests"
git commit -m "test(v0.2.x): Add usePosts hook tests"
git commit -m "test(v0.2.x): Add PostsList component tests"

# v0.3.x: DATA - 타입/스키마별 커밋
git commit -m "feat(v0.3.x): Add posts domain type definitions"
git commit -m "chore(v0.3.x): Update database.types.ts from Supabase"

# v0.4.x: CODE - 레이어별 커밋
git commit -m "feat(v0.4.x): Implement PostsRepository with core-supabase patterns"
git commit -m "feat(v0.4.x): Implement postsClient API client"
git commit -m "feat(v0.4.x): Implement usePosts hook with React Query"
git commit -m "feat(v0.4.x): Add PostsHeader component"
git commit -m "feat(v0.4.x): Add PostsList component"
git commit -m "feat(v0.4.x): Add PostsEmptyState component"
```

## 자동 커밋 트리거

- 새 파일 생성 완료 후 → 즉시 커밋
- 기존 파일 수정 완료 후 → 즉시 커밋
- 테스트 통과 확인 후 → 즉시 커밋
- Phase 완료 시 → 요약 커밋 (이미 커밋된 것 제외)

## 커밋 메시지 형식

```text
:gitmoji: #issue-number subject
```

### 이슈 번호 추출 규칙 (🔴 CRITICAL)

브랜치명에서 자동 추출: `{number}-{feature-name}` → `#{number}`

```bash
# 예시:
#   브랜치: 35-comment-ui → #35
#   브랜치: 001-dynamic-gnb-menus → #001
#   브랜치: fix/42-login-bug → #42
```

### 이슈 번호 추출 방법

```bash
# 현재 브랜치에서 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
echo "#$ISSUE_NUM"  # 예: #35, #001
```

## Gitmoji 사용

| Gitmoji | Type | 사용 시점 |
|---------|------|----------|
| ✨ `:sparkles:` | feat | 새 기능 |
| 🐛 `:bug:` | fix | 버그 수정 |
| 🔧 `:wrench:` | chore | 설정, 구조 |
| ✅ `:white_check_mark:` | test | 테스트 |
| ♻️ `:recycle:` | refactor | 리팩토링 |
| 📝 `:memo:` | docs | 문서 |

## Phase별 커밋 메시지 예시

브랜치: `35-comment-ui`

```bash
# v0.1.x: PROJECT
git commit -m "🔧 #35 Create comment domain directory structure"

# v0.2.x: TESTS
git commit -m "✅ #35 Add CommentRepository unit tests"

# v0.4.x: CODE
git commit -m "✨ #35 Implement CommentRepository with core-supabase patterns"
git commit -m "✨ #35 Add CommentList component"
```

## 이슈 번호가 없는 브랜치

예: `dev`, `main`, `feature/no-issue`

```bash
# 이슈 번호 생략 가능
git commit -m "🔧 Update configuration"
```

## 금지 사항

- ❌ 여러 Phase 혼합 커밋
- ❌ "WIP" 또는 "temp" 커밋 메시지
- ❌ 5개 이상 파일을 하나의 커밋에 포함
- ❌ Phase 완료 후에만 몰아서 커밋
