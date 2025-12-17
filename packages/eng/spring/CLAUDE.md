# SEMO Engineering - Spring Platform

> Spring Boot 백엔드 개발

## Package Info

- **Package**: eng/platforms/spring
- **Version**: [../../VERSION](../../VERSION) 참조
- **Target**: core-backend, core-interface
- **Audience**: Backend 개발자

---

## Mode Support

이 패키지는 **모드 시스템**을 지원합니다:

| 모드 | 파일 | 용도 |
|------|------|------|
| `mvp` | [modes/mvp.md](../../modes/mvp.md) | 속도 우선, 컨벤션 최소화 |
| `prod` | [modes/prod.md](../../modes/prod.md) | 품질 우선, 풀 컨벤션 (기본값) |

```markdown
# MVP 모드
[eng/spring --mode=mvp] 빠르게 API 만들어줘

# Production 모드 (기본값)
[eng/spring] API 구현해줘
```

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
| `@Transactional` | Coroutine context 사용 |

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | 작업 라우팅 및 의도 분석 |
| implementation-master | Phase-gated 구현 |
| quality-master | 코드 품질 검증 |
| domain-architect | CQRS 도메인 설계 |
| spec-master | 스펙 관리 |
| debug-master | 디버깅 지원 |

---

## Skills

| Skill | 역할 |
|-------|------|
| implement | 구현 (ADD Phase 4) |
| verify-implementation | 구현 검증 |
| verify-reactive | Reactive 코드 검증 |
| scaffold-domain | CQRS 도메인 구조 생성 |
| run-tests | 테스트 실행 |
| git-workflow | Git 워크플로우 |
| health-check | 환경 검증 |

---

## Quality Gates (Production Mode)

### Pre-Commit
```bash
./gradlew ktlintCheck
```

### Pre-PR
```bash
./gradlew test
./gradlew build
```

---

## References

- [eng 레이어](../../CLAUDE.md)
- [MVP 모드](../../modes/mvp.md)
- [Production 모드](../../modes/prod.md)
- [nextjs 패키지](../nextjs/CLAUDE.md)
