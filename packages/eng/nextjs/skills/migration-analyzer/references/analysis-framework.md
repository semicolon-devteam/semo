# Analysis Framework

## Phase 1: Project Structure Analysis (구조 분석)

```bash
# 1. 현재 프로젝트 구조 파악
tree -L 3 -I 'node_modules|.git|.next' src/

# 2. cm-template 기준 구조
src/
├── app/
│   └── {domain}/
│       ├── _repositories/    # ⭐ DDD Layer 1
│       ├── _api-clients/     # ⭐ DDD Layer 2
│       ├── _hooks/           # ⭐ DDD Layer 3
│       ├── _components/      # ⭐ DDD Layer 4
│       └── page.tsx
├── components/               # Atomic Design
│   ├── atoms/
│   ├── molecules/
│   ├── organisms/
│   └── templates/
├── models/                   # 타입 정의
└── lib/
    ├── supabase/
    └── utils/
```

**체크리스트**:

- [ ] DDD 4-Layer 구조 존재 여부
- [ ] Atomic Design 계층 구조 준수
- [ ] 도메인별 디렉토리 분리
- [ ] Repository/API Client 패턴 사용
- [ ] models/ 디렉토리 (vs types/)

## Phase 2: Documentation Analysis (문서 분석)

**필수 문서 체크**:

| 문서 | 경로 | 상태 |
|------|------|------|
| CLAUDE.md | `./CLAUDE.md` | [ ] 존재 / [ ] 누락 |
| README.md | `./README.md` | [ ] 존재 / [ ] 누락 |
| Constitution | `.specify/memory/constitution.md` | [ ] 존재 / [ ] 누락 |
| .claude/ 디렉토리 | `.claude/` | [ ] 존재 / [ ] 누락 |
| templates/ 폴더 | `./templates/` | [ ] 존재 / [ ] 누락 |

**문서 내용 검증**:

```bash
# CLAUDE.md 필수 섹션 확인
grep -l "DDD" CLAUDE.md
grep -l "Supabase" CLAUDE.md
grep -l "SSR-First" CLAUDE.md

# CLAUDE.md 불변 원칙 섹션 존재 여부
grep -l "🔴 불변 원칙" CLAUDE.md
grep -l "Team Codex" CLAUDE.md
```

## Phase 3: Architecture Compliance (아키텍처 준수)

**DDD Architecture Check**:

```bash
# Repository 패턴 확인
find src -name "*Repository*" -o -name "*repository*"

# API Client 패턴 확인
find src -name "*Client*" -o -name "*client*" | grep -v node_modules

# 'use client' 위치 확인 (Repository에 있으면 위반)
grep -r "'use client'" src/app/*/_repositories/ 2>/dev/null

# 직접 Supabase import 확인 (components에서 직접 import는 위반)
grep -r "@supabase/supabase-js" src/components/ 2>/dev/null
```

**SSR-First Check**:

```bash
# 불필요한 'use client' 검출
grep -r "'use client'" src/app/*/page.tsx 2>/dev/null
```

## Phase 4: Supabase Integration Check

**Storage 버킷 규격**:

```bash
# Storage 사용 패턴 확인
grep -r "supabase.storage" src/

# 버킷명 확인 (public-bucket / private-bucket 규격)
grep -r "from\('" src/ | grep storage
```

**RPC 함수 패턴**:

```bash
# RPC 호출 확인
grep -r "supabase.rpc" src/

# 타입 assertion 패턴 확인
grep -r "as unknown as" src/
```

## Phase 5: Code Quality Check

```bash
# ESLint 검사
npm run lint

# TypeScript 검사
npx tsc --noEmit

# 'any' 타입 사용 검출
grep -r ": any" src/ --include="*.ts" --include="*.tsx"

# console.log 검출
grep -r "console.log" src/ --include="*.ts" --include="*.tsx"
```

## Phase 6: Team Codex Compliance

**커밋 메시지 형식**:

```bash
# 최근 커밋 메시지 패턴 확인
git log --oneline -20

# 형식: type(scope): subject
# 예: feat(posts): Add comment functionality
```

**브랜치 전략**:

```bash
# 현재 브랜치 확인
git branch -a

# feature/, fix/, spike/ 브랜치 패턴 확인
```
