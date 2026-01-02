# Dependency Handling

## Dependency Detection

Parse tasks.md for dependency indicators:

```markdown
### 1.2 Write Repository tests

**Depends on**: Task 1.1 (Scaffold structure)

- Test `PostsRepository.getPosts()`
- ...
```

## Issue Linking

### In Issue Body (Metadata 섹션)

새 구조에서는 Metadata 테이블에 의존성 포함:

```markdown
## 📊 Metadata

| Field | Value |
|-------|-------|
| Layer | v0.2.x TESTS |
| Domain | posts |
| Epic | #144 |
| Depends on | #145, #146 |
```

### GitHub CLI

```bash
# Add dependency comment (선택사항)
gh issue comment 147 --body "Depends on #145, #146"
```

## Dependency Chain Example

```text
Epic #144: Add comment functionality
  │
  ├─ #145 [CONFIG] Check dependencies
  │    │
  │    └─ #146 [PROJECT] Scaffold structure
  │         │
  │         ├─ #147 [TESTS] Repository tests
  │         │    │
  │         │    └─ #151 [CODE] Repository implementation
  │         │
  │         ├─ #148 [TESTS] Hooks tests
  │         │    │
  │         │    └─ #153 [CODE] Hooks implementation
  │         │
  │         └─ #149 [TESTS] Component tests
  │              │
  │              └─ #154-#159 [CODE] Components
```

## Creation Order

Issues는 반드시 의존성 순서대로 생성:

1. 의존성이 없는 Task (CONFIG) 먼저 생성
2. 생성된 Issue 번호를 후속 Task의 Depends on에 기록
3. 순차적으로 모든 Layer 처리

```bash
# 의존성 순서 예시
CONFIG → PROJECT → TESTS → DATA → CODE
```
