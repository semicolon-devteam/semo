# Commit Guide

## Issue Number Extraction

**🔴 CRITICAL**: 모든 커밋 메시지에 브랜치명 기반 이슈 번호를 포함합니다.

```bash
# 현재 브랜치에서 이슈 번호 추출
get_issue_number() {
  ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
  if [ -n "$ISSUE_NUM" ]; then
    echo "#$ISSUE_NUM"
  else
    echo ""
  fi
}
```

**브랜치 패턴 → 이슈 번호**:

| 브랜치명 | 추출된 이슈 번호 |
|----------|------------------|
| `35-comment-ui` | `#35` |
| `001-dynamic-gnb-menus` | `#001` |
| `fix/42-login-bug` | `#42` |
| `feature/auth-refactor` | (없음) |
| `dev`, `main` | (없음) |

## Commit Message Format

**형식**: `:gitmoji: #issue-number subject`

### Gitmoji 매핑

| Gitmoji | Type | 사용 시점 |
|---------|------|-----------|
| ✨ `:sparkles:` | feat | 새 기능 추가 |
| 🐛 `:bug:` | fix | 버그 수정 |
| 🔧 `:wrench:` | chore | 설정, 구조 변경 |
| ✅ `:white_check_mark:` | test | 테스트 추가/수정 |
| ♻️ `:recycle:` | refactor | 리팩토링 |
| 📝 `:memo:` | docs | 문서 작성/수정 |
| 🎨 `:art:` | style | 코드 스타일/포맷 |
| 🔥 `:fire:` | remove | 코드/파일 삭제 |
| 🚀 `:rocket:` | deploy | 배포 관련 |
| 🔄 `:arrows_counterclockwise:` | sync | 동기화, 업데이트 |

## Auto Type Detection

```yaml
detection_rules:
  feat:
    - 새 파일 생성 (컴포넌트, 훅, API 등)
    - "Add", "Create", "Implement" 키워드
  fix:
    - 기존 파일 수정 (에러 관련)
    - "Fix", "Resolve", "Correct" 키워드
  test:
    - __tests__/ 폴더 내 파일
    - .test.ts, .test.tsx, .spec.ts 파일
  docs:
    - .md 파일 수정
    - README, CLAUDE.md, spec.md 등
  chore:
    - 설정 파일 (package.json, tsconfig.json 등)
    - 디렉토리 구조 변경
  refactor:
    - 기존 파일 수정 (기능 변경 없이 구조 개선)
```

## Commit Workflow

**Step 1**: 상태 확인

```bash
git status
git branch --show-current
```

**Step 2**: 이슈 번호 추출

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

**Step 3**: 변경 사항 분석 및 타입 결정

```bash
git diff --stat
git diff --name-only
```

**Step 4**: 커밋 메시지 생성 및 커밋

```bash
# 이슈 번호가 있는 경우
git commit -m "✨ #${ISSUE_NUM} Add new feature component"

# 이슈 번호가 없는 경우
git commit -m "✨ Add new feature component"
```

## Atomic Commit Support

**원칙**:

- **1 파일 = 1 커밋** (가능한 경우)
- **1 기능 단위 = 1 커밋** (관련 파일 2-3개)
- **NEVER**: 5개 이상 파일을 하나의 커밋에 포함 금지

**자동 분할 제안**:

```markdown
⚠️ 5개 이상의 파일이 변경되었습니다.

변경된 파일:
1. src/app/posts/_components/PostsHeader.tsx
2. src/app/posts/_components/PostsList.tsx
3. src/app/posts/_components/PostsFilter.tsx
4. src/app/posts/_hooks/usePosts.ts
5. src/app/posts/_repositories/PostsRepository.ts
6. src/models/posts/index.ts

**권장**: 다음과 같이 분할 커밋:
1. `✨ #35 Add PostsRepository` (Repository)
2. `✨ #35 Add usePosts hook` (Hook)
3. `✨ #35 Add Posts components` (Components 3개)
4. `✨ #35 Add posts type definitions` (Models)

분할하여 커밋할까요? (Y/n)
```
