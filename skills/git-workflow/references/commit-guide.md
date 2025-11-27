# Commit Guide

> **SoT 참조**: 커밋 규칙은 `sax-core/TEAM_RULES.md` 섹션 1.2, 1.3에서 관리됩니다.

## 이슈 번호 추출 스크립트

```bash
# 현재 브랜치에서 이슈 번호 추출
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

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
