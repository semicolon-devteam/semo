<!-- SEMO Framework -->
> **SEMO** = "Semicolon Orchestrate" - AI 에이전트 오케스트레이션 프레임워크
> (이전 명칭: SAX - Semicolon AI Transformation)

# SAX-Backend Package Configuration

> Spring Boot 백엔드 개발자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-Backend
- **Version**: 📌 [VERSION](./VERSION) 참조
- **Target**: core-backend, core-interface
- **Audience**: Backend 개발자

---

## 🔴 핵심 규칙 (NON-NEGOTIABLE)

### 1. 세션 초기화

> 📖 상세: [_shared/INIT_SETUP.md](../_shared/INIT_SETUP.md)

새 세션 시작 시 자동 실행 (4-Phase):
```text
버전 체크 → 구조 검증 → 동기화 검증 → 메모리 복원
```

### 2. SAX Core 참조

> 📖 상세: [_shared/SAX_CORE_REFERENCE.md](../_shared/SAX_CORE_REFERENCE.md)

### 3. Orchestrator 위임

> 📖 상세: [_shared/ORCHESTRATOR_RULES.md](../_shared/ORCHESTRATOR_RULES.md)

모든 요청 → `agents/orchestrator/orchestrator.md` → Agent/Skill 라우팅

---

## Workflow: SDD + ADD

### Spec-First Branching

```text
dev 브랜치
  ├── [SDD Phase 1-3] Spec 작성 → specs/{domain}/*.md
  └── Feature 브랜치 분기 → {issue-number}-{feature-name}
        └── [ADD Phase 4] 코드 구현 → Draft PR → Merge
```

### ADD (Agent-Driven Development)

| 버전 | 단계 | 설명 |
|------|------|------|
| v0.0.x | CONFIG | build.gradle.kts 의존성 확인 |
| v0.1.x | PROJECT | scaffold-domain (CQRS 구조) |
| v0.2.x | TESTS | TDD (Testcontainers) |
| v0.3.x | DATA | Entity, DTO, Repository |
| v0.4.x | CODE | Service, Controller (Reactive) |

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

### 핵심 패턴

| 패턴 | 설명 |
|------|------|
| CQRS | Command/Query 서비스 분리 |
| String const | enum 대신 `object { const val }` |
| Sealed Exception | 도메인별 예외 계층 |
| ApiResponse | 통일된 응답 봉투 |

---

## 🔴 금지 사항 (NON-NEGOTIABLE)

| 항목 | 대안 |
|------|------|
| `.block()` | `awaitSingle()`, `collect {}` |
| `enum class` | String const pattern |
| `println` | Logger 사용 |
| `--no-verify` | 에러 수정 후 커밋 |
| `Thread.sleep()` | `delay()` |

---

## Quality Gates

```bash
# Pre-commit (필수)
./gradlew ktlintCheck && ./gradlew compileKotlin

# Pre-PR (필수)
./gradlew ktlintCheck && ./gradlew compileKotlin && ./gradlew test

# Reactive 검증 (.block() 호출 검사)
grep -r "\.block()" src/main/ --include="*.kt"
```

---

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
