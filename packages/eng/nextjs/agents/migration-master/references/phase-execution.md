# Phase Execution Details

> migration-master Agent의 Phase별 상세 실행 내용

## Phase 1: Foundation

### Step 1.1: templates/ 폴더 카피

```bash
# cm-template의 templates/ 폴더를 대상 프로젝트 루트로 복사
gh api repos/semicolon-devteam/cm-template/contents/templates --jq '.[].name'

# 복사 후 폴더 구조:
# ./templates/
# ├── CLAUDE.template.md
# └── README.template.md
```

### Step 1.2: 기존 문서 분석 및 백업

```bash
mkdir -p .migration-backup
[ -f README.md ] && cp README.md .migration-backup/README.md.bak
[ -f CLAUDE.md ] && cp CLAUDE.md .migration-backup/CLAUDE.md.bak
```

### Step 1.3: CLAUDE.md 융합

> 📚 상세: [document-merge.md](document-merge.md)

### Step 1.4: .claude/ 디렉토리 설정

```bash
gh api repos/semicolon-devteam/cm-template/contents/.claude --jq '.[].name'

mkdir -p .claude/agents
mkdir -p .claude/skills
```

### Step 1.5: Constitution 설정

```bash
mkdir -p .specify/memory

gh api repos/semicolon-devteam/cm-template/contents/.specify/memory/constitution.md \
  --jq '.content' | base64 -d > .specify/memory/constitution.md
```

### 체크포인트

```markdown
✅ **Phase 1 완료**

- [x] `templates/` 폴더 카피됨
- [x] 기존 문서 백업됨 (`.migration-backup/`)
- [x] `CLAUDE.md` 융합 완료
- [x] `README.md` 융합 완료
- [x] `.claude/` 디렉토리 생성됨
- [x] Constitution 설정됨
```

## Phase 2: Structure

```bash
# 1. DDD 디렉토리 구조 생성
mkdir -p src/app/{domain}/_repositories
mkdir -p src/app/{domain}/_api-clients
mkdir -p src/app/{domain}/_hooks
mkdir -p src/app/{domain}/_components

# 2. Atomic Design 디렉토리 생성 (없는 경우)
mkdir -p src/components/atoms
mkdir -p src/components/molecules
mkdir -p src/components/organisms
mkdir -p src/components/templates

# 3. models/ 디렉토리 생성
mkdir -p src/models
```

### 체크포인트

```markdown
✅ **Phase 2 완료**

- [x] DDD 4-Layer 디렉토리 생성
- [x] Atomic Design 디렉토리 확인
- [x] models/ 디렉토리 준비
```

## Phase 3: Code Migration

### Repository 마이그레이션

```typescript
// Before: src/repositories/post.repository.ts
// After: src/app/posts/_repositories/posts.repository.ts

// 변경사항:
// 1. 경로 이동
// 2. createServerSupabaseClient 사용 확인
// 3. 'use client' 제거 확인
// 4. 타입 assertion 패턴 적용
```

### API Client 마이그레이션

```typescript
// Before: src/api-clients/post.client.ts
// After: src/app/posts/_api-clients/posts.client.ts

// 변경사항:
// 1. 경로 이동
// 2. Factory Pattern 적용
// 3. index.ts export 추가
```

### Hooks 마이그레이션

```typescript
// Before: src/hooks/usePosts.ts
// After: src/app/posts/_hooks/usePosts.ts

// 변경사항:
// 1. 경로 이동
// 2. 도메인별 API Client import 경로 수정
// 3. index.ts export 추가
```

### Components 마이그레이션

```typescript
// 도메인 컴포넌트: src/app/{domain}/_components/
// 공용 컴포넌트: src/components/{atomic-layer}/
```

### 체크포인트

```markdown
✅ **Phase 3 완료**

- [x] Repository 마이그레이션: [N]개 파일
- [x] API Client 마이그레이션: [N]개 파일
- [x] Hooks 마이그레이션: [N]개 파일
- [x] Components 마이그레이션: [N]개 파일

Import 에러 확인:
```bash
npx tsc --noEmit
```
```

## Phase 4: Supabase Alignment

```typescript
// Storage 버킷명 변경
// Before: supabase.storage.from('avatars')
// After: supabase.storage.from('public-bucket')

// 경로 패턴 통일
// Before: `${userId}/${filename}`
// After: `avatars/${userId}/${filename}`

// RPC 파라미터 prefix 통일
// Before: { limit, offset }
// After: { p_limit, p_offset }
```

### 체크포인트

```markdown
✅ **Phase 4 완료**

- [x] Storage 버킷명: `public-bucket`, `private-bucket`
- [x] 경로 패턴: `{type}/{ownerId}/{filename}`
- [x] RPC 파라미터: `p_` prefix
```

## Phase 5: Cleanup

```bash
# 1. 레거시 파일 제거
rm -rf src/services/  # 사용하지 않는 경우
rm -rf src/types/     # models/로 마이그레이션 완료 후

# 2. 품질 검사
npm run lint
npx tsc --noEmit

# 3. any 타입 검출 및 수정
grep -r ": any" src/

# 4. console.log 제거
grep -r "console.log" src/
```

### 체크포인트

```markdown
✅ **Phase 5 완료**

- [x] 레거시 파일 제거
- [x] ESLint 통과: [✅/❌]
- [x] TypeScript 통과: [✅/❌]
- [x] any 타입: [N]개 남음
- [x] console.log: [N]개 남음
```

## Completion

```markdown
## 🎉 Migration Complete!

**마이그레이션 결과**:

| 항목          | Before | After |
| ------------- | ------ | ----- |
| 준수율        | [X]%   | [Y]%  |
| DDD 구조      | ❌     | ✅    |
| 문서화        | ❌     | ✅    |
| Supabase 패턴 | ❌     | ✅    |

**다음 단계**:

1. 변경사항 커밋:
   ```bash
   git add .
   git commit -m "chore: migrate to semicolon community standard"
   ```

2. 테스트 실행:
   ```bash
   npm test
   ```

3. PR 생성 (선택):
   ```bash
   gh pr create --title "chore: migrate to semicolon community standard"
   ```
```
