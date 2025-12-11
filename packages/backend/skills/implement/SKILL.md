---
name: implement
description: |
  ADD Phase 4 구현 워크플로우. Use when:
  (1) spec.md/plan.md/tasks.md 완료, (2) 기능 구현 요청,
  (3) CQRS + Reactive 패턴 구현.
tools: [Read, Write, Edit, Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: implement 호출 - {구현 대상}` 시스템 메시지를 첫 줄에 출력하세요.

# Implement Skill

@./../_shared/reactive-guide.md
@./../_shared/cqrs-patterns.md
@./../_shared/commit-guide.md

> ADD Phase 4 구현 오케스트레이션 (Spring Boot)

## When to Use

- SDD Phase 1-3 완료 (spec.md, plan.md, tasks.md)
- 기능 구현 요청
- CQRS + Reactive 패턴 구현

## Phase Overview

| Phase | Name | Key Action |
|-------|------|------------|
| v0.0.x | CONFIG | build.gradle.kts 의존성 확인 |
| v0.1.x | PROJECT | scaffold-domain (CQRS 구조) |
| v0.2.x | TESTS | TDD - 테스트 먼저 작성 |
| v0.3.x | DATA | Entity, DTO, Repository |
| v0.4.x | CODE | Service, Controller (Reactive) |

## Usage

```javascript
skill: implement();
skill: implement({ resume: "v0.3.x" });  // Resume from phase
```

## Phase Execution

### v0.0.x CONFIG

```bash
# 의존성 확인
cat build.gradle.kts | grep -A 50 "dependencies"
```

필요한 의존성:
- spring-boot-starter-webflux
- spring-boot-starter-data-r2dbc
- kotlinx-coroutines-reactor

### v0.1.x PROJECT

```javascript
skill: scaffold-domain("{domain}");
```

### v0.2.x TESTS (TDD)

```kotlin
@Testcontainers
class PostRepositoryTest {
    @Container
    val postgres = PostgreSQLContainer("postgres:15")

    @Test
    fun `should save post`() = runTest {
        // Given, When, Then
    }
}
```

### v0.3.x DATA

```javascript
skill: lookup-migration();  // 스키마 확인
```

Entity, DTO, Repository 작성

### v0.4.x CODE

```javascript
skill: sync-openapi("{endpoint}");  // API 스펙 확인
```

Service, Controller 구현

## Output Format

### Phase 완료

```markdown
[SAX] Skill: implement - v0.2.x TESTS 완료

## 완료된 작업
- [x] PostRepositoryTest.kt
- [x] PostCommandServiceTest.kt
- [x] PostQueryServiceTest.kt

## 테스트 결과
✅ All tests passed (15/15)

## 커밋
✅ #35 Add tests for posts domain

## 다음 Phase
v0.3.x DATA → Entity, DTO, Repository 작성

진행할까요?
```

### 구현 완료

```markdown
[SAX] Skill: implement 완료 - {feature}

## 구현 완료

| Phase | Status | Commit |
|-------|--------|--------|
| v0.0.x CONFIG | ✅ | 🔧 #35 Add dependencies |
| v0.1.x PROJECT | ✅ | 🏗️ #35 Scaffold posts domain |
| v0.2.x TESTS | ✅ | ✅ #35 Add tests |
| v0.3.x DATA | ✅ | 📦 #35 Add entity and repository |
| v0.4.x CODE | ✅ | ✨ #35 Implement services |

## 다음 단계

1. `skill:verify-reactive` - Reactive 검증
2. `skill:check-team-codex` - 품질 검증
3. PR 생성: "PR 만들어줘"
```

## Critical Rules

1. **Phase 순서 준수**: 절대 스킵 금지
2. **TDD 필수**: v0.2.x 완료 전 v0.4.x 금지
3. **Reactive Only**: `.block()` 절대 금지
4. **CQRS 분리**: Command/Query 분리 필수
5. **Atomic Commits**: Phase별 커밋

## Dependencies

- `scaffold-domain` - v0.1.x PROJECT
- `lookup-migration` - v0.3.x DATA
- `sync-openapi` - v0.4.x CODE
- `verify-reactive` - 완료 후 검증

## References

- [Phase Workflow](references/phase-workflow.md)
- [Commit Strategy](references/commit-strategy.md)
