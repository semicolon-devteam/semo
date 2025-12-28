# Output Format Reference

## Success

```markdown
[SEMO] Skill: check-team-codex 실행

## ✅ 모든 검사 통과

| Check | Status |
|-------|--------|
| ktlint | ✅ 0 violations |
| Compile | ✅ BUILD SUCCESSFUL |
| Tests | ✅ All passed |
| .block() | ✅ 없음 |
| Debug code | ✅ 없음 |

**커밋 가능** 🚀
```

## Failure

```markdown
[SEMO] Skill: check-team-codex 실행

## ❌ 검사 실패

| Check | Status |
|-------|--------|
| ktlint | ❌ 3 violations |
| Compile | ✅ BUILD SUCCESSFUL |
| .block() | ❌ 1개 발견 |

### 🔴 CRITICAL

1. **ktlint 위반**
   - `PostService.kt:10`: Missing trailing comma

2. **.block() 호출**
   - `UserRepository.kt:45`: `.block()` 사용
   ```kotlin
   // ❌ 현재
   repository.findById(id).block()
   // ✅ 수정
   repository.findById(id).awaitSingleOrNull()
   ```

**조치 필요**: 위 이슈를 수정 후 다시 검사하세요.
```
