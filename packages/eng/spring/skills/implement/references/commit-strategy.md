# Commit Strategy Reference

## Atomic Commits

각 Phase 완료 시 커밋:

```bash
# v0.0.x CONFIG
git add build.gradle.kts
git commit -m "🔧 #35 Add webflux and r2dbc dependencies"

# v0.1.x PROJECT
git add domain/posts/
git commit -m "🏗️ #35 Scaffold posts domain structure"

# v0.2.x TESTS
git add domain/posts/**/*Test.kt
git commit -m "✅ #35 Add tests for posts domain"

# v0.3.x DATA
git add domain/posts/entity/ domain/posts/repository/
git commit -m "📦 #35 Add Post entity and repository"

# v0.4.x CODE
git add domain/posts/service/ domain/posts/web/
git commit -m "✨ #35 Implement post services and controller"
```

## Commit Message Format

```text
:gitmoji: #issue-number subject
```

## File Grouping

| Phase | Files |
|-------|-------|
| v0.0.x | build.gradle.kts |
| v0.1.x | domain/{domain}/**/ (empty structure) |
| v0.2.x | **/*Test.kt |
| v0.3.x | entity/, repository/, request/, response/ |
| v0.4.x | service/, controller/, exception/ |

## Rules

- 1 Phase = 1 Commit
- 5개 이상 파일 시 분할 고려
- `--no-verify` 절대 금지
