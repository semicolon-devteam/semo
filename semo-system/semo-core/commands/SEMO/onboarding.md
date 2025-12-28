# /SEMO:onboarding

새 프로젝트에 SEMO를 설치하거나, 새 팀원을 위한 온보딩 가이드를 제공합니다.
**v4.0 통합 구조 기반으로 동적 가이드를 생성합니다.**

## 사용법

```
/SEMO:onboarding
```

## 동작

1. **Runtime 감지**: 프로젝트 파일을 스캔하여 Runtime 자동 감지
2. **동적 가이드 생성**: 감지된 Runtime에 맞는 온보딩 가이드 생성
3. **권장 다음 단계**: 해당 Runtime의 주요 스킬 안내

## 실행 프로세스

```
[SEMO] Skill: onboarding 호출

=== SEMO 온보딩 가이드 (v4.0) ===

## 1. 설치된 구성

### semo-core (통합)
✓ 166개 스킬 통합
✓ 41개 에이전트 통합
✓ Runtime References (nextjs, spring, infra)
✓ Domain References (biz, ops)

### 감지된 Runtime
{자동 감지된 Runtime 표시}

---

## 2. 사용 가능한 기능

{Runtime별 주요 스킬 목록}

---

## 3. 빠른 시작

{Runtime별 quickstart 예시}

[SEMO] Skill: onboarding 완료
```

## Runtime 감지 로직

### 1. 파일 기반 감지

| Runtime | 필수 파일 | 신뢰도 |
|---------|----------|--------|
| **nextjs** | `next.config.*` | 🟢 확정 |
| **spring** | `build.gradle.kts` + `application.yml` | 🟢 확정 |
| **go** | `go.mod` | 🟢 확정 |
| **python** | `pyproject.toml` | 🟢 확정 |
| **infra** | `docker-compose.yml` (only) | 🟡 추론 |

### 2. 영속화

감지 결과는 `.claude/memory/runtime.md`에 저장:

```markdown
# Runtime Configuration

## Active Runtime
| 항목 | 값 |
|------|-----|
| **Primary** | nextjs |
| **Detected** | 2025-12-28 |
| **Method** | auto (next.config.ts) |
```

## Runtime별 가이드

### Next.js

```markdown
## 2. 사용 가능한 기능

### Core Skills
- `implement` - 코드 작성/수정
- `git-workflow` - Git 커밋/PR
- `tester` - 테스트 작성
- `verify` - 구현 검증

### Next.js 전용 Skills
- `nextjs-implement` - Next.js 특화 구현
- `scaffold-domain` - DDD 4-Layer 도메인 생성
- `supabase-typegen` - Supabase 타입 동기화
- `e2e-test` - Playwright E2E 테스트

### References
- `references/runtimes/nextjs/architecture.md` - DDD 4-Layer
- `references/runtimes/nextjs/code-patterns.md` - 코드 패턴
```

### Spring

```markdown
## 2. 사용 가능한 기능

### Core Skills
- `implement` - 코드 작성/수정
- `git-workflow` - Git 커밋/PR
- `tester` - 테스트 작성

### Spring 전용 Skills
- `spring-implement` - Spring Boot 특화 구현
- `spring-verify-implementation` - 구현 검증
- `verify-reactive` - Reactive 패턴 검증
- `run-tests` - Testcontainers 테스트

### References
- `references/runtimes/spring/architecture.md` - CQRS 아키텍처
- `references/runtimes/spring/reactive.md` - Reactive 가이드
```

## 빠른 시작 템플릿

### 공통

```markdown
## 3. 빠른 시작

### 기본 사용법
"로그인 기능 만들어줘"     → skill:implement
"커밋하고 PR 만들어줘"     → skill:git-workflow
"테스트 작성해줘"          → skill:tester
```

### Next.js 전용

```markdown
### Next.js 전용
"Button 도메인 만들어줘"   → skill:scaffold-domain
"Supabase 타입 동기화"     → skill:supabase-typegen
"E2E 테스트 작성해줘"      → skill:e2e-test
```

### Spring 전용

```markdown
### Spring 전용
"User 도메인 CQRS로"       → skill:spring-implement
"Reactive 검증해줘"        → skill:verify-reactive
"Testcontainers 테스트"    → skill:run-tests
```

## SEMO Message Format

```markdown
[SEMO] Skill: onboarding 호출 - Runtime 감지 중

[SEMO] Onboarding: Runtime 감지 완료 (nextjs)

[SEMO] Skill: onboarding 완료
```

## 참조

- [Runtime Detection Rules](../../references/_detect.md)
- [SEMO CLI](https://www.npmjs.com/package/@team-semicolon/semo-cli)
- [SEMO 원칙](../../principles/PRINCIPLES.md)
