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

### In Issue Body

```markdown
## 🔗 Dependencies

Depends on: #145, #146

**Blocks**: None
```

### GitHub CLI

```bash
# Add dependency comment
gh issue comment 147 --body "Depends on #145, #146"
```

## Dependency Chain Example

```
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
