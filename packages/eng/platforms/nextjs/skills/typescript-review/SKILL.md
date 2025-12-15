---
name: typescript-review
description: |
  Review TypeScript/React code for compliance with Semicolon coding standards,
  DDD architecture, and quality requirements. Use when reviewing PRs or code changes.
tools: [Read, Grep, Bash, Glob]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: typescript-review 호출` 시스템 메시지를 첫 줄에 출력하세요.

# TypeScript/React Code Review Skill

@./../_shared/nextjs-commands.md
@./../_shared/quality-gates.md
@./../_shared/ddd-patterns.md

## Review Focus Areas

### 1. DDD Architecture Compliance

```bash
# 4-layer 구조 확인
ls app/{domain}/_{repositories,api-clients,hooks,components}

# Repository에 'use client' 없는지 확인
grep -r "'use client'" app/{domain}/_repositories/

# Import chain 검증
grep -r "createBrowserClient" app/{domain}/_repositories/  # 있으면 ❌
```

### 2. Code Quality

```bash
# ESLint 검사
npm run lint

# TypeScript 타입 체크
npx tsc --noEmit

# Debug 코드 검색
grep -rn "console\.log\|debugger" src/ --include="*.ts" --include="*.tsx"

# 'any' 타입 검색
grep -rn ":\s*any\|as any" src/ --include="*.ts" --include="*.tsx"
```

### 3. Test Coverage

```bash
# 테스트 실행 및 커버리지
npm test -- --coverage

# Coverage thresholds: Repository 80%, Hooks 80%, Components 70%
```

### 4. Supabase Patterns

- Server client 사용 확인 (`createServerSupabaseClient`)
- RPC 네이밍 규칙 준수 (`{domain}s_read`, `{domain}s_create`)
- Type assertion 패턴 (`as unknown as Type`)

## Review Checklist

### Critical (PR 차단)

- [ ] TypeScript 컴파일 에러 없음
- [ ] 모든 테스트 통과
- [ ] DDD 4-layer 구조 준수
- [ ] Repository에 `'use client'` 없음
- [ ] Console.log 없음

### Warning (수정 권장)

- [ ] 'any' 타입 사용 없음 (또는 정당한 사유)
- [ ] 커버리지 threshold 충족
- [ ] JSDoc 주석 존재

### Suggestion (선택)

- [ ] 성능 최적화 (memoization 등)
- [ ] 접근성 개선 (aria-labels 등)
- [ ] 에지 케이스 테스트

## Review Output Format

```markdown
## Code Review Report

**PR**: #{pr_number}
**Reviewer**: AI (typescript-review skill)

### Summary
- Critical Issues: {count}
- Warnings: {count}
- Suggestions: {count}

### Critical Issues 🔴
1. [파일:라인] 이슈 설명

### Warnings 🟡
1. [파일:라인] 이슈 설명

### Suggestions 🟢
1. [파일:라인] 개선 제안

### Verdict
✅ APPROVED | ⚠️ APPROVED WITH WARNINGS | ❌ CHANGES REQUESTED
```

## Integration Points

| Skill | 관계 |
|-------|------|
| `verify` | 자동화 검증 (complementary) |
| `check-team-codex` | Team Codex 검증 |
| `validate-architecture` | 아키텍처 검증 |

## References

- [Quality Gates](../_shared/quality-gates.md) - 품질 기준 상세
- [DDD Patterns](../_shared/ddd-patterns.md) - 아키텍처 규칙
- [Browser Testing](../_shared/browser-testing.md) - 브라우저 테스트
