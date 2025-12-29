# /SEMO:onboarding

새 프로젝트에 SEMO를 설치하거나, 새 팀원을 위한 온보딩 가이드를 제공합니다.
**v5.0 통합 구조 기반으로 동적 가이드를 생성합니다.**

## 사용법

```
/SEMO:onboarding
```

## 동작

1. **🔴 레거시 환경 감지**: 구버전 SEMO 구조가 있는지 확인
2. **Runtime 감지**: 프로젝트 파일을 스캔하여 Runtime 자동 감지
3. **동적 가이드 생성**: 감지된 Runtime에 맞는 온보딩 가이드 생성
4. **권장 다음 단계**: 해당 Runtime의 주요 스킬 안내

---

## 🔴 Phase 0: 레거시 환경 감지 (필수)

> **온보딩 시작 전 반드시 레거시 환경을 확인합니다.**

### 레거시 구조 판별

| 레거시 경로 | 정상 경로 | 설명 |
|------------|----------|------|
| `/semo-core/` (루트) | `/semo-system/semo-core/` | 구버전 위치 |
| `/semo-skills/` (루트) | `/semo-system/semo-skills/` | 구버전 위치 |
| `/sax-core/` (루트) | 삭제 필요 | SAX 레거시 |
| `/sax-skills/` (루트) | 삭제 필요 | SAX 레거시 |
| `.claude/agents → ../semo-core/` | `.claude/agents → ../semo-system/semo-core/agents/` | 심볼릭 링크 |

### 감지 시 동작

```text
/SEMO:onboarding 실행
    │
    ├─ 레거시 환경 감지됨
    │   ├─ ⚠️ 경고 메시지 출력
    │   ├─ 마이그레이션 가이드 안내
    │   └─ 온보딩 중단 (마이그레이션 먼저)
    │
    └─ 레거시 없음
        └─ 정상 온보딩 진행
```

### 레거시 감지 시 출력

```markdown
[SEMO] Skill: onboarding 호출

⚠️ 레거시 SEMO 환경이 감지되었습니다.

### 감지된 레거시 경로
- semo-core/ (루트에 직접 위치)
- semo-skills/ (루트에 직접 위치)
- .claude/agents → ../semo-core/agents (레거시 링크)

### 마이그레이션 필요

v5.0 구조에서는 모든 Standard 패키지가 `semo-system/` 하위에 위치합니다:

```
semo-system/
├── semo-core/
├── semo-skills/
├── semo-agents/
└── semo-scripts/
```

### 마이그레이션 방법

**CLI 사용 (권장):**
```bash
semo migrate --force
semo init
```

**수동 마이그레이션:**
1. 루트의 `semo-core/`, `semo-skills/` 폴더 삭제
2. `.claude/` 폴더 삭제
3. `semo init` 실행

[SEMO] Skill: onboarding 중단 - 마이그레이션 후 다시 실행하세요.
```

---

## 실행 프로세스

```
[SEMO] Skill: onboarding 호출

=== SEMO 온보딩 가이드 (v5.0) ===

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
