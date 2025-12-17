# Phase Workflow Reference

## Phase Flow

```text
v0.0.x CONFIG
    │
    ├─ Check build.gradle.kts
    ├─ Add missing dependencies
    └─ Commit: 🔧 #{issue} Add dependencies
    │
    ▼
v0.1.x PROJECT
    │
    ├─ skill:scaffold-domain {domain}
    ├─ Create directory structure
    └─ Commit: 🏗️ #{issue} Scaffold structure
    │
    ▼
v0.2.x TESTS (TDD)
    │
    ├─ Write Repository tests
    ├─ Write Service tests
    ├─ Verify tests fail (red)
    └─ Commit: ✅ #{issue} Add tests
    │
    ▼
v0.3.x DATA
    │
    ├─ skill:lookup-migration
    ├─ Create Entity
    ├─ Create Repository
    ├─ Create DTOs
    └─ Commit: 📦 #{issue} Add entity and repository
    │
    ▼
v0.4.x CODE
    │
    ├─ skill:sync-openapi
    ├─ Implement CommandService
    ├─ Implement QueryService
    ├─ Implement Controller
    ├─ skill:verify-reactive
    └─ Commit: ✨ #{issue} Implement services
```

## Gate Conditions

### v0.0.x → v0.1.x

- [ ] build.gradle.kts 확인 완료
- [ ] 필요한 의존성 추가

### v0.1.x → v0.2.x

- [ ] 도메인 구조 생성 완료
- [ ] 디렉토리 구조 검증

### v0.2.x → v0.3.x

- [ ] 테스트 파일 작성 완료
- [ ] 테스트 실패 확인 (Red)

### v0.3.x → v0.4.x

- [ ] Entity 작성 완료
- [ ] Repository 작성 완료
- [ ] 일부 테스트 통과

### v0.4.x → Complete

- [ ] 모든 테스트 통과
- [ ] Reactive 검증 통과
- [ ] 품질 게이트 통과

## Skip Conditions

> **일반적으로 Phase 스킵은 금지됩니다.**

예외적 스킵 허용:

| Phase | Skip 조건 |
|-------|-----------|
| v0.0.x | 의존성 이미 존재 |
| v0.1.x | 구조 이미 존재 |
| v0.2.x | ❌ 스킵 절대 금지 |
| v0.3.x | Entity 이미 존재 |
| v0.4.x | ❌ 스킵 불가 |
