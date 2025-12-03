# SAX-Backend Package Configuration

> Spring Boot 백엔드 개발자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-Backend
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: core-backend, core-interface
- **Audience**: Backend 개발자

---

## 🔴 새 세션 시작 시 버전 체크 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, SAX 패키지 버전을 확인하고 업데이트를 제안합니다.**

### 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

---

## 🔴 세션 시작 시 구조 검증 (NON-NEGOTIABLE)

> **새 세션에서 첫 작업 전, .claude 구조 무결성을 검증합니다.**

### 검증 스킬 호출 (폴백 체인)

1. `.claude/skills/sax-architecture-checker/SKILL.md` 존재 시 → 해당 스킬 실행
2. 없으면 → `.claude/sax-core/skills/sax-architecture-checker/SKILL.md` 실행

### 검증 실행 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (.claude/sax-* 존재)

### 검증 대상 항목

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 디렉토리 상태
- 깨진 심링크 탐지 및 자동 복구

### 체크 워크플로우

```bash
# 1. 로컬 버전 확인
LOCAL_VERSION=$(cat .claude/sax-backend/VERSION 2>/dev/null)

# 2. 원격 버전 확인
REMOTE_VERSION=$(gh api repos/semicolon-devteam/sax-backend/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 3. 비교
if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "UPDATE_AVAILABLE"
fi
```

### 업데이트 가능 시 출력

```markdown
[SAX] version-updater: 업데이트 가능

📦 **SAX 업데이트 알림**

현재 버전: {local_version}
최신 버전: {remote_version}

업데이트하려면: "SAX 업데이트해줘"
```

### 최신 상태 시 출력 (선택)

```markdown
[SAX] version-updater: 최신 버전 확인 ✅

SAX {version}이 설치되어 있습니다.
```

---

## 🔴 SAX Core 필수 참조 (NON-NEGOTIABLE)

> **모든 응답 전에 반드시 sax-core 문서를 참조합니다.**

### 필수 참조 파일

| 파일 | 용도 | 참조 시점 |
|------|------|----------|
| `sax-core/PRINCIPLES.md` | SAX 핵심 원칙 | 모든 작업 전 |
| `sax-core/MESSAGE_RULES.md` | 메시지 포맷 규칙 | 모든 응답 시 |
| `sax-core/TEAM_RULES.md` | 팀 규칙 | Git, 품질 관련 작업 |

### 참조 방법

```bash
# 로컬 설치된 경우
.claude/sax-core/PRINCIPLES.md
.claude/sax-core/MESSAGE_RULES.md

# 또는 GitHub API
gh api repos/semicolon-devteam/sax-core/contents/PRINCIPLES.md --jq '.content' | base64 -d
```

---

## 🔴 Orchestrator 위임 필수 (NON-NEGOTIABLE)

> **모든 사용자 요청은 반드시 Orchestrator를 통해 라우팅됩니다.**

### 동작 규칙

1. **사용자 요청 수신 시**: 즉시 `agents/orchestrator/orchestrator.md` 읽기
2. **Orchestrator가 적절한 Agent/Skill 결정**
3. **SAX 메시지 포맷으로 라우팅 결과 출력**

### 예외 없음

- 단순 질문도 Orchestrator 거침
- 직접 Agent/Skill 호출 금지
- CLAUDE.md에서 Agent 목록 참조하지 않음 (Orchestrator가 관리)

### 메시지 포맷 (sax-core/MESSAGE_RULES.md 준수)

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

---

## Workflow: SDD + ADD

### Spec-First Branching (NEW)

```text
┌─────────────────────────────────────────────────────────────┐
│ dev 브랜치                                                   │
│   ├── [SDD Phase 1-3] Spec 작성                             │
│   │   └── specs/{domain}/spec.md, plan.md, tasks.md         │
│   ├── 커밋: 📝 #{이슈번호} Add spec for {도메인}             │
│   └── git push origin dev (원격 공유)                        │
│                                                              │
│       └── Feature 브랜치 분기                                │
│           └── {issue-number}-{feature-name}                  │
│               ├── [ADD Phase 4] 코드 구현                    │
│               └── Draft PR → Ready → Merge                   │
└─────────────────────────────────────────────────────────────┘
```

> **목적**: 다른 작업자도 특정 도메인의 Spec을 공유받을 수 있도록 함

### 브랜치별 작업 구분

| 브랜치 | 작업 | 산출물 |
|--------|------|--------|
| `dev` | SDD (Spec 작성) | spec.md, plan.md, tasks.md |
| `feature/*` | ADD (코드 구현) | 실제 구현 코드 |

### SDD (Spec-Driven Development) - Phase 1-3 (dev 브랜치)

```text
/speckit.specify → specs/{domain}/spec.md
/speckit.plan → specs/{domain}/plan.md
/speckit.tasks → specs/{domain}/tasks.md
→ 커밋 & 푸시 → Feature 브랜치 생성
```

### ADD (Agent-Driven Development) - Phase 4 (feature 브랜치)

```text
v0.0.x CONFIG → build.gradle.kts 의존성 확인
v0.1.x PROJECT → scaffold-domain (CQRS 구조)
v0.2.x TESTS → TDD (Testcontainers)
v0.3.x DATA → Entity, DTO, Repository
v0.4.x CODE → Service, Controller (Reactive)
```

### Verification - Phase 5

```text
skill:verify-reactive → Reactive 패턴 검증 (.block() 금지)
skill:check-team-codex → ktlint, 컴파일 검증
skill:verify-implementation → 요구사항 구현 확인
```

---

## Architecture: Domain + CQRS

### 도메인 구조

```text
domain/{domain_name}/
├── entity/              # 엔티티 (String const 패턴)
├── repository/          # R2DBC Repository + Custom
├── service/
│   ├── {Domain}CommandService.kt  # 쓰기 작업
│   └── {Domain}QueryService.kt    # 읽기 작업
├── web/
│   ├── {Domain}Controller.kt
│   ├── request/
│   └── response/
├── exception/           # Sealed Exception
└── validation/          # 검증 로직 (선택)
```

### CQRS Pattern

| Service | 역할 | 메서드 예시 |
|---------|------|------------|
| CommandService | 쓰기 작업 | `create()`, `update()`, `delete()` |
| QueryService | 읽기 작업 | `findById()`, `findAll()`, `search()` |

### String Const Pattern (enum 대체)

```kotlin
// DO: String const pattern
object PostStatus {
    const val DRAFT = "DRAFT"
    const val PUBLISHED = "PUBLISHED"
    const val ARCHIVED = "ARCHIVED"
}

// DON'T: Kotlin enum
enum class PostStatus { DRAFT, PUBLISHED, ARCHIVED }
```

### ApiResponse Pattern

```kotlin
sealed class ApiResponse<T> {
    data class Success<T>(
        val success: Boolean = true,
        val data: T,
        val message: String? = null,
        val timestamp: Instant = Instant.now()
    )

    data class PagedSuccess<T>(
        val success: Boolean = true,
        val data: List<T>,
        val pagination: Pagination,
        val message: String? = null,
        val timestamp: Instant = Instant.now()
    )

    data class Error(
        val success: Boolean = false,
        val message: String,
        val errorCode: String? = null,
        val fieldErrors: Map<String, String>? = null,
        val timestamp: Instant = Instant.now()
    )
}
```

### Sealed Exception Pattern

```kotlin
sealed class PostException(message: String) : RuntimeException(message) {
    class NotFound(id: UUID) : PostException("Post not found: $id")
    class AlreadyExists(title: String) : PostException("Post already exists: $title")
    class InvalidStatus(status: String) : PostException("Invalid status: $status")
}
```

---

## Quality Gates

### Pre-commit (필수)

```bash
./gradlew ktlintCheck && ./gradlew compileKotlin
```

### Pre-PR (필수)

```bash
./gradlew ktlintCheck && ./gradlew compileKotlin && ./gradlew test
```

### Reactive 검증 (필수)

```bash
# .block() 호출 검사 - 절대 금지
grep -r "\.block()" src/main/ --include="*.kt"
```

---

## 금지 사항 (NON-NEGOTIABLE)

| 항목 | 설명 | 대안 |
|------|------|------|
| `.block()` | Reactive 위반 | `awaitSingle()`, `collect {}` |
| `enum class` | 직렬화 문제 | String const pattern |
| `println` | Debug 코드 | Logger 사용 |
| `--no-verify` | Hook 우회 | 에러 수정 후 커밋 |
| `Thread.sleep()` | 블로킹 | `delay()` |

---

## External References

### core-interface (API Spec)

```bash
# OpenAPI 스펙 조회
gh api repos/semicolon-devteam/core-interface/contents/openapi-spec.json \
  --jq '.content' | base64 -d
```

**Swagger UI**: https://core-interface-ashen.vercel.app/

### core-supabase (DB Schema)

```bash
# Flyway 마이그레이션 조회
gh api repos/semicolon-devteam/core-supabase/contents/docker/volumes/db/migrations \
  --jq '.[].name'
```

> **Note**: RPC 함수는 제거 예정. Spring Boot로 전환 중.

---

## Security

### Endpoint 보안 어노테이션

```kotlin
@PublicApi           // 인증 없이 접근 가능
@RequireRole("USER") // USER 역할 필요
@RequireRole("ADMIN") // ADMIN 역할 필요
```

### JWT 검증

- Supabase JWT 사용
- Spring Security + WebFlux Security 적용

---

## PO 연동 (SAX-PO)

SAX-PO에서 생성된 Epic은 다음과 같이 연동됩니다:

1. **PO (SAX-PO)**: Epic 생성 → docs 레포에 이슈 생성
2. **PO (SAX-PO)**: Draft Task 생성 → core-backend에 Draft Issue
3. **개발자 (SAX-Backend)**: `/speckit.specify`로 spec.md 보완
4. **개발자 (SAX-Backend)**: `/speckit.plan`, `/speckit.tasks`
5. **개발자 (SAX-Backend)**: `skill:implement`로 구현
6. **개발자 (SAX-Backend)**: `skill:verify`로 검증
7. **개발자 (SAX-Backend)**: PR 생성 → Review → Merge

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [SAX Core - Team Rules](https://github.com/semicolon-devteam/sax-core/blob/main/TEAM_RULES.md)
