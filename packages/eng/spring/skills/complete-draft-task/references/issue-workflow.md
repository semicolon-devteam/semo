# Issue Workflow Reference

## Draft Task Lifecycle

```text
PO: Draft 작성
    ↓
[status:draft]
    ↓
PO: Ready 전환
    ↓
[status:ready]
    ↓
Dev: 작업 시작
    ↓
[status:in-progress]
    ↓
Dev: 구현 완료
    ↓
[status:review-requested]
    ↓
PO: 검토
    ├── 승인 → [status:approved] → Merge
    └── 수정 요청 → [status:in-progress] → 재작업
```

## Label 관리

### 상태 라벨

```bash
# 상태 전환: ready → in-progress
gh issue edit 123 --add-label "status:in-progress"
gh issue edit 123 --remove-label "status:ready"

# 상태 전환: in-progress → review-requested
gh issue edit 123 --add-label "status:review-requested"
gh issue edit 123 --remove-label "status:in-progress"
```

### 도메인 라벨

| Label | 용도 |
|-------|------|
| `domain:posts` | Posts 도메인 |
| `domain:users` | Users 도메인 |
| `domain:comments` | Comments 도메인 |

### 타입 라벨

| Label | 용도 |
|-------|------|
| `type:feature` | 새 기능 |
| `type:bug` | 버그 수정 |
| `type:refactor` | 리팩토링 |

## 이슈-PR 연결

```bash
# PR 생성 시 이슈 연결
gh pr create --title "✨ #123 Implement posts domain" \
  --body "Closes #123"

# PR에서 이슈 자동 닫기 키워드
# - Closes #123
# - Fixes #123
# - Resolves #123
```

## 코멘트 템플릿

### 작업 시작

```markdown
## 작업 시작 🚀

- 브랜치: `feature/123-posts-domain`
- 예상 완료: 2일

### 구현 계획
1. Entity, Repository 구현
2. Service 구현 (CQRS)
3. Controller, DTO 구현
4. 테스트 작성
```

### 구현 완료

```markdown
## 구현 완료 🎉

### 완료된 작업
- [x] Post Entity 및 Repository
- [x] PostCommandService / PostQueryService
- [x] PostController 및 DTOs
- [x] 테스트 (커버리지: 85%)

### PR
- #456

@{po_username} 검토 부탁드립니다.
```
