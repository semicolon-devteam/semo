# Phase Workflow Reference

## Phase Flow

```text
v0.0.x CONFIG
    ↓
v0.1.x PROJECT
    ↓
v0.2.x TESTS (TDD - Red)
    ↓
v0.3.x DATA
    ↓
v0.4.x CODE (Green)
    ↓
Verify & Refactor
```

## Gate Conditions

### v0.0.x → v0.1.x
- build.gradle.kts 확인 완료
- 의존성 추가 완료

### v0.1.x → v0.2.x
- 도메인 구조 생성 완료
- scaffold-domain 실행 완료

### v0.2.x → v0.3.x
- 테스트 파일 작성 완료
- 테스트 실패 확인 (Red)

### v0.3.x → v0.4.x
- Entity 작성 완료
- Repository 작성 완료
- 일부 테스트 통과

### v0.4.x → Complete
- 모든 테스트 통과 (Green)
- Reactive 검증 통과
- 품질 게이트 통과

## Commit Strategy

| Phase | Gitmoji | Example |
|-------|---------|---------|
| v0.0.x | 🔧 | `🔧 #35 Add webflux dependencies` |
| v0.1.x | 🏗️ | `🏗️ #35 Scaffold posts domain` |
| v0.2.x | ✅ | `✅ #35 Add tests for posts` |
| v0.3.x | 📦 | `📦 #35 Add Post entity` |
| v0.4.x | ✨ | `✨ #35 Implement post services` |
