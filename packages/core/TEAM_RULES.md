# Semicolon Team Rules

> SAX Core - Semicolon 팀 공통 규칙 (Single Source of Truth)

## 기본 설정

| 항목 | 값 |
|------|-----|
| **응답 언어** | 한글 |
| **기본 Organization** | `semicolon-devteam` |
| **이슈 템플릿** | `.github/ISSUE_TEMPLATE` 기반 |

---

## 1. Git Workflow

### 1.1 브랜치 전략

**형식**: `{issue-number}-{feature-name}` 또는 `fix/{issue-number}-{description}`

| 유형 | 패턴 | 예시 |
|------|------|------|
| Feature | `{issue}-{feature}` | `35-comment-ui` |
| Fix | `fix/{issue}-{description}` | `fix/42-login-redirect` |

**필수 규칙**:
- main/master에서 직접 작업 금지
- Feature Branch에서만 작업

### 1.2 커밋 메시지 포맷

**형식**: `:gitmoji: #issue-number subject`

| Gitmoji | Type | 사용 시점 |
|---------|------|-----------|
| ✨ | feat | 새 기능 추가 |
| 🐛 | fix | 버그 수정 |
| 🔧 | chore | 설정, 구조 변경 |
| ✅ | test | 테스트 추가/수정 |
| ♻️ | refactor | 리팩토링 |
| 📝 | docs | 문서 작성/수정 |
| 🎨 | style | 코드 스타일/포맷 |
| 🔥 | remove | 코드/파일 삭제 |
| 🔖 | release | 버전/릴리스 |

**예시**:
- ✅ `✨ #35 Add comment functionality`
- ✅ `🐛 #42 Fix login redirect issue`
- ❌ `updated code` (형식 미준수)

### 1.3 이슈 번호 추출

브랜치명에서 자동 추출:

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

| 브랜치명 | 추출 결과 |
|----------|----------|
| `35-comment-ui` | `#35` |
| `fix/42-login-bug` | `#42` |
| `main` | (없음) |

### 1.4 Atomic Commit

- **1 기능 단위 = 1 커밋** (관련 파일 2-3개)
- **5개 이상 파일 변경 시**: 분할 커밋 권장

### 1.5 --no-verify 금지 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `--no-verify` 또는 `-n` 플래그는 **어떤 상황에서도 사용 금지**

- 사용자가 명시적으로 요청해도 **거부**
- 긴급 상황이라도 **거부**
- 에러 발생 시 → 에러 수정 후 커밋

---

## 2. Code Quality (Team Codex)

### 2.1 필수 검증 항목

| 검증 항목 | 명령어 | 기대 결과 |
|-----------|--------|----------|
| ESLint | `npm run lint` | 0 errors, 0 warnings |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| 테스트 | `npm run test` | All passed |

### 2.2 금지 사항

| 항목 | 설명 | 검출 명령어 |
|------|------|-------------|
| Debug 코드 | `console.log`, `debugger` | `grep -r "console\.log\|debugger" src/` |
| any 타입 | 명시적 타입 사용 필수 | `grep -r ":\s*any\|as any" src/` |
| 주석 처리된 코드 | 불필요한 코드 삭제 | 수동 검토 |
| hook 우회 | `--no-verify` 금지 | 커밋 로그 검사 |

### 2.3 타입 안전성

- `any` 대신 `unknown` 사용
- Strict null checks 활성화
- `models/` 디렉토리에 타입 정의

### 2.4 Import 규칙

- 모듈러 임포트 (대형 라이브러리)
- 와일드카드 임포트 금지 (`import *`)
- `@/` alias 사용

### 2.5 Severity Levels

| Level | 항목 | 조치 |
|-------|------|------|
| 🔴 CRITICAL | ESLint/TS 에러, hook 우회, 아키텍처 위반 | PR 차단 |
| 🟡 WARNING | Debug 코드, any 타입, TODO 주석 | 수정 권장 |
| 🟢 INFO | 스타일 제안, 성능 힌트 | 선택적 |

---

## 3. DDD Architecture (Next.js)

### 3.1 4-Layer 구조

```text
src/app/{domain}/
├── _repositories/     # Layer 1: 서버사이드 Supabase
├── _api-clients/      # Layer 2: 브라우저 HTTP
├── _hooks/            # Layer 3: React Query + 상태
├── _components/       # Layer 4: 도메인 전용 UI
└── page.tsx
```

### 3.2 Layer 규칙

| Layer | `'use client'` | Supabase 직접 접근 |
|-------|----------------|-------------------|
| Repository | ❌ 금지 | ✅ 허용 |
| API Client | ✅ 필수 | ❌ 금지 |
| Hooks | ✅ 필수 | ❌ 금지 |
| Components | ✅ 필수 | ❌ 금지 |

### 3.3 Server Components 우선

- 기본: Server Components
- `'use client'`는 필요한 경우에만
- Dynamic imports로 Heavy components 분리

---

## 4. Supabase Backend

### 4.1 문서 우선 확인

```bash
# core-supabase 테스트 문서
gh api repos/semicolon-devteam/core-supabase/contents/document/test

# RPC 함수 정의
gh api repos/semicolon-devteam/core-supabase/contents/docker/volumes/db/init/functions/05-posts
```

### 4.2 핵심 원칙

- **기존 RPC 사용**: 새로 만들지 않음
- **타입 안전성**: `as unknown as Type`
- **파라미터 처리**: `null as unknown as undefined`

### 4.3 주요 RPC 함수

| 도메인 | 함수명 |
|--------|--------|
| Posts | `posts_read`, `posts_create`, `posts_update`, `posts_delete` |
| Comments | `comments_create`, `comments_read`, `comments_update`, `comments_delete` |
| Reactions | `reactions_toggle`, `reactions_get` |

---

## 5. Testing Standards

### 5.1 테스트 구조

| 테스트 유형 | 대상 | 최소 커버리지 |
|-------------|------|--------------|
| Unit | Repository | 70% |
| Integration | Hooks | 70% |
| Component | UI | 70% |

### 5.2 테스트 파일 위치

- `__tests__/` 폴더 내
- `.test.ts`, `.test.tsx`, `.spec.ts` 확장자

---

## 6. Quality Gates

### 6.1 Pre-commit (필수)

```bash
npm run lint && npx tsc --noEmit
```

### 6.2 Pre-PR (필수)

```bash
npm run lint && npx tsc --noEmit && npm test
```

### 6.3 CI/CD (자동)

- 모든 검증 자동 실행
- 실패 시 PR 차단

---

## 7. 문서 참조 체계

### 7.1 공식 문서 (Wiki)

| 카테고리 | URL |
|----------|-----|
| 개발 철학 | https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy |
| 협업 프로세스 | https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process |
| 코딩 컨벤션 | https://github.com/semicolon-devteam/docs/wiki/Dev-Conventions-Code |
| 테스트 컨벤션 | https://github.com/semicolon-devteam/docs/wiki/Dev-Conventions-Testing |

### 7.2 프로세스 가이드

| Phase | URL |
|-------|-----|
| Epic 생성 | https://github.com/semicolon-devteam/docs/wiki/Process-Phase-1-Epic-Creation |
| Task 생성 | https://github.com/semicolon-devteam/docs/wiki/Process-Phase-2-Task-Creation |
| 개발 | https://github.com/semicolon-devteam/docs/wiki/Process-Phase-3-Development |
| 배포 | https://github.com/semicolon-devteam/docs/wiki/Process-Phase-4-Deployment |

### 7.3 충돌 시 처리

요청이 규칙과 충돌 시:

```text
[SAX] 문서 갱신 제안

현재 요청: [요청 내용]
기존 규칙: [기존 규칙]
충돌 사항: [충돌 내용]

제안 사항:
- [구체적 갱신 내용]
- [갱신 위키 페이지]
```

---

## 참조 방법

```bash
# 로컬 (SAX 설치된 환경)
.claude/sax-core/TEAM_RULES.md

# GitHub API
gh api repos/semicolon-devteam/sax-core/contents/TEAM_RULES.md --jq '.content' | base64 -d
```
