# Commit Guide Reference

## Format

```text
:gitmoji: #issue-number subject
```

## Gitmoji

| Emoji | Type | Use |
|-------|------|-----|
| ✨ | feat | 새 기능 |
| 🐛 | fix | 버그 수정 |
| 🔧 | chore | 설정 변경 |
| ✅ | test | 테스트 |
| ♻️ | refactor | 리팩토링 |
| 📝 | docs | 문서 |
| 🏗️ | arch | 구조 변경 |
| 📦 | data | 데이터/모델 |

## Examples

```text
✨ #35 Add post creation endpoint
🐛 #42 Fix null pointer in PostService
✅ #35 Add PostRepositoryTest
📦 #35 Add Post entity and repository
```

## Rules

- `--no-verify` 절대 금지
- 1 기능 = 1 커밋
- 5개 이상 파일 → 분할 권장
