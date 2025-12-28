---
name: implement-mvp
description: Phase-gated MVP 구현 워크플로우 실행
tools: [Read, Write, Edit, Bash, Glob, Grep]
---

> **시스템 메시지**: `[SEMO] Skill: implement-mvp 호출 - MVP 구현`

# Implement MVP Skill

## Purpose

간소화된 ADD (Agent-Driven Development) 워크플로우를 따라 MVP 기능을 구현합니다.

## Quick Start

```bash
/SEMO:implement

# 또는 특정 Phase부터 시작
/SEMO:implement --phase=DATA
```

---

## Phases Overview

| Version | Phase | 산출물 |
|---------|-------|--------|
| v0.0.x | SETUP | 의존성, 환경 변수 |
| v0.1.x | DOMAIN | 4-layer 폴더 구조 |
| v0.2.x | DATA | 타입, Repository |
| v0.3.x | CODE | API Client, Hooks, Components |
| v0.4.x | TEST | 테스트, 시각적 검증 |

---

## Phase 0: SETUP

### 체크리스트

- [ ] 필요한 의존성 설치
- [ ] 환경 변수 설정
- [ ] Supabase 클라이언트 설정

### 실행

```bash
# 의존성 설치
pnpm add @tanstack/react-query @supabase/ssr

# 환경 변수 확인
cat .env.local | grep SUPABASE
```

### 커밋

```bash
git commit -m "feat({domain}): [SETUP] Initialize {feature} dependencies"
```

---

## Phase 1: DOMAIN

### 체크리스트

- [ ] 도메인 폴더 구조 생성
- [ ] Index 파일 설정
- [ ] page.tsx 스켈레톤

### 실행

```bash
# skill:scaffold-mvp-domain 사용
/SEMO:scaffold {domain}
```

### 커밋

```bash
git commit -m "feat({domain}): [DOMAIN] Scaffold {domain} 4-layer structure"
```

---

## Phase 2: DATA

### 체크리스트

- [ ] core-interface 타입 동기화
- [ ] 도메인 타입 정의
- [ ] Repository 구현

### 실행

```typescript
// 1. 타입 정의
// _types/{domain}.types.ts
interface {Domain}Metadata {
  type: '{domain}';
  // MVP 필드
}

// 2. Repository 구현
// _repositories/{Domain}Repository.ts
class {Domain}Repository {
  async findAll() { /* Supabase 쿼리 */ }
}
```

### 검증

```bash
pnpm tsc --noEmit
```

### 커밋

```bash
git commit -m "feat({domain}): [DATA] Add {domain} types and repository"
```

---

## Phase 3: CODE

### 체크리스트

- [ ] API Client 구현
- [ ] React Query Hooks 구현
- [ ] UI Components 구현
- [ ] page.tsx 연결

### 실행

```typescript
// 1. API Client
// _api-clients/{Domain}ApiClient.ts

// 2. Hooks
// _hooks/use{Domain}.ts

// 3. Components
// _components/{Domain}List.tsx
// _components/{Domain}Card.tsx
```

### 검증

```bash
pnpm lint
pnpm build
```

### 커밋

```bash
git commit -m "feat({domain}): [CODE] Implement {domain} hooks and components"
```

---

## Phase 4: TEST

### 체크리스트

- [ ] 통합 테스트 작성 (선택)
- [ ] Antigravity 브라우저 테스트
- [ ] 시각적 검증
- [ ] skill:verify-integration 실행

### 실행

```markdown
## Antigravity 테스트

1. Antigravity IDE에서 프로젝트 열기
2. `/browser-test http://localhost:3000/{domain}` 실행
3. 스크린샷 캡처

## 통합 검증

/SEMO:verify
```

### 커밋

```bash
git commit -m "feat({domain}): [TEST] Add {domain} tests and verification"
```

---

## 전체 워크플로우 실행

```markdown
[SEMO] Skill: implement-mvp 시작

## 현재 상태
- 도메인: {domain}
- 현재 Phase: {current_phase}
- 현재 버전: {version}

---

## Phase 체크리스트

### Phase 0: SETUP
- [ ] 의존성 설치
- [ ] 환경 변수 설정

### Phase 1: DOMAIN
- [ ] 폴더 구조 생성

### Phase 2: DATA
- [ ] 타입 정의
- [ ] Repository 구현

### Phase 3: CODE
- [ ] API Client
- [ ] Hooks
- [ ] Components

### Phase 4: TEST
- [ ] 브라우저 테스트
- [ ] 통합 검증

---

진행하시겠습니까? (y/n)
```

---

## 에러 처리

### Build 실패

```markdown
[SEMO] Build 실패 감지

## 오류 로그
{error_log}

## 가능한 원인
1. 타입 불일치
2. 누락된 import
3. ESLint 오류

## 권장 액션
{fix_suggestion}
```

### Phase 실패

```markdown
[SEMO] Phase {n} 실패

## 누락 항목
{missing_items}

## 이전 Phase 확인 필요
- Phase {n-1} 산출물 검증
- 누락된 파일 확인

## 다시 시도
/SEMO:implement --phase={n}
```

---

## 커밋 템플릿

```bash
# HEREDOC 사용
git commit -m "$(cat <<'EOF'
feat({domain}): [{phase}] {description}

- {detail_1}
- {detail_2}
- {detail_3}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Related Skills

- `git-workflow` - 커밋/푸시/PR (구현 완료 후)
- `verify-integration` - 통합 검증

---

## 🔴 Post-Action: 완료 시 푸시/PR 프롬프트 (NON-NEGOTIABLE)

> **⚠️ 전체 Phase 완료 시 푸시/PR 여부 프롬프트를 표시합니다.**

### 완료 시 출력

```markdown
[SEMO] Skill: implement-mvp → 완료

✅ **MVP 구현 완료**: {feature_name}

**Phase 커밋 현황**:
- v0.0.x SETUP: ✅ committed
- v0.1.x DOMAIN: ✅ committed
- v0.2.x DATA: ✅ committed
- v0.3.x CODE: ✅ committed
- v0.4.x TEST: ✅ committed

---

💡 **다음 단계**:
   - "푸시해줘" → 원격 저장소에 푸시
   - "PR 만들어줘" → `skill:git-workflow` 호출하여 Draft PR 생성
   - "verify" → 통합 검증
```

### 자동 동작

- **Phase 완료 시**: 자동으로 커밋 생성
- **전체 완료 시**: 푸시/PR 여부 프롬프트 표시
- **사용자 "PR 만들어줘"**: `skill:git-workflow` 호출

---

## References

- [Phase Workflow](references/phase-workflow.md)
- [Integration Test](references/integration-test.md)
