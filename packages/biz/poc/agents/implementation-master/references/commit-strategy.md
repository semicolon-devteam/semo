# Commit Strategy Guide

## Commit Message Format

```
{type}({scope}): [{phase}] {description}

{body}

{footer}
```

### Type
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서
- `test`: 테스트
- `chore`: 기타

### Scope
도메인명 또는 영역

### Phase
`[SETUP]`, `[DOMAIN]`, `[DATA]`, `[CODE]`, `[TEST]`

---

## Phase별 커밋 예시

### SETUP Phase

```bash
git commit -m "feat(office): [SETUP] Initialize office domain dependencies

- Add @tanstack/react-query
- Add @supabase/supabase-js
- Configure environment variables
- Set up Supabase client

🤖 Generated with Claude Code"
```

### DOMAIN Phase

```bash
git commit -m "feat(office): [DOMAIN] Scaffold office 4-layer structure

- Create _repositories/ folder
- Create _api-clients/ folder
- Create _hooks/ folder
- Create _components/ folder
- Create _types/ folder
- Add index.ts re-exports

🤖 Generated with Claude Code"
```

### DATA Phase

```bash
git commit -m "feat(office): [DATA] Add office types and repository

- Sync core-interface types
- Define OfficeMetadata interface
- Implement OfficeRepository
- Add metadata extension patterns

🤖 Generated with Claude Code"
```

### CODE Phase

```bash
git commit -m "feat(office): [CODE] Implement office hooks and components

- Add OfficeApiClient
- Implement useOffices hook
- Implement useOfficeMutation hook
- Add OfficeList component
- Add OfficeCard component
- Connect page.tsx

🤖 Generated with Claude Code"
```

### TEST Phase

```bash
git commit -m "feat(office): [TEST] Add office tests and verification

- Add OfficeRepository integration tests
- Complete browser testing via Antigravity
- Verify schema compliance
- Capture visual screenshots

🤖 Generated with Claude Code"
```

---

## Atomic Commit Rules

### 1. Single Phase per Commit

```bash
# Good
git commit -m "feat(office): [DATA] Add office types"
git commit -m "feat(office): [DATA] Add office repository"

# Bad
git commit -m "feat(office): Add types, repository, hooks, and components"
```

### 2. Logical Grouping

같은 Phase 내에서 논리적으로 연관된 변경은 하나의 커밋으로:

```bash
# Good: 타입과 관련 인터페이스를 함께
git commit -m "feat(office): [DATA] Add office types and DTOs"

# Good: Repository와 테스트를 함께
git commit -m "feat(office): [DATA] Add office repository with tests"
```

### 3. Working State

각 커밋 후 프로젝트는 빌드 가능해야 함:

```bash
# 커밋 전 확인
pnpm tsc --noEmit
pnpm lint
pnpm build
```

---

## Branch Strategy

### Feature Branch

```bash
# 브랜치 생성
git checkout -b feature/office-mvp

# Phase별 커밋
git commit -m "feat(office): [SETUP] ..."
git commit -m "feat(office): [DOMAIN] ..."
git commit -m "feat(office): [DATA] ..."
git commit -m "feat(office): [CODE] ..."
git commit -m "feat(office): [TEST] ..."

# PR 생성
gh pr create --title "feat(office): Add office MVP feature"
```

### Commit Squashing

PR 머지 시 Phase별로 스쿼시 권장:

```bash
# 5개 커밋을 1개로 스쿼시
git rebase -i HEAD~5

# 최종 커밋 메시지
feat(office): Add office MVP feature

- [SETUP] Initialize dependencies
- [DOMAIN] Scaffold 4-layer structure
- [DATA] Add types and repository
- [CODE] Implement hooks and components
- [TEST] Add tests and verification

🤖 Generated with Claude Code
```

---

## Co-Author Attribution

```bash
git commit -m "feat(office): [CODE] Implement office components

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```
