# Commit Guide Reference

## 🔴 Spec 커밋 규칙 (dev 브랜치)

> **핵심**: Spec은 dev 브랜치에서 작성하고, 원격에 푸시하여 팀과 공유

### 커밋 메시지 형식

```bash
# Spec 추가
📝 #{이슈번호} Add spec for {도메인}

# Spec 수정
📝 #{이슈번호} Update spec - {변경 내용}
```

### 이슈 번호 추출 (dev 브랜치)

```bash
# 방법 1: SEMO 메타데이터 활용
ISSUE_NUM=$(jq -r '.SEMO.currentTask.issueNumber' ~/.claude.json 2>/dev/null)

# 방법 2: 최근 작업 이슈 확인
gh issue list --assignee @me --state open --json number,title
```

### Spec 커밋 워크플로우

```bash
# 1. dev 브랜치에서 Spec 커밋
git commit -m "📝 #${ISSUE_NUM} Add spec for {domain}"

# 2. 원격 푸시 (팀 공유)
git push origin dev

# 3. Feature 브랜치 생성 (코드 구현용)
git checkout -b ${ISSUE_NUM}-{feature-name}
```

---

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
