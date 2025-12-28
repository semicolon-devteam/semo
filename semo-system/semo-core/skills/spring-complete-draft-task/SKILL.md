---
name: complete-draft-task
description: |
  PO Draft Task 완료 처리. Use when:
  (1) 구현 완료 후 이슈 업데이트, (2) PO 검토 요청,
  (3) Draft Task → Ready for Review 상태 전환.
tools: [Bash, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: complete-draft-task 호출 - {이슈 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# Complete Draft Task Skill

@./../_shared/commit-guide.md

> PO Draft Task 완료 및 검토 요청

## When to Use

- 구현 완료 후 이슈 상태 업데이트
- PO 검토 요청
- Draft Task 완료 처리

## Prerequisites

1. `skill:verify-implementation` 통과
2. 모든 커밋 완료
3. PR 생성 완료 (선택)

## Workflow

```text
구현 완료
    ↓
verify-implementation ✅
    ↓
complete-draft-task
    ├── 1. 이슈 상태 업데이트
    ├── 2. 구현 요약 코멘트
    └── 3. PO 검토 요청
```

## Execution Steps

### Step 1: 이슈 번호 확인

```bash
# 현재 브랜치에서 이슈 번호 추출
git branch --show-current | grep -oE '[0-9]+'
```

### Step 2: 구현 요약 작성

```markdown
## 구현 완료 보고

### 완료된 작업
- [x] Entity 및 Repository 구현
- [x] CommandService / QueryService 구현
- [x] Controller 및 DTO 구현
- [x] 테스트 작성 (커버리지: 85%)

### 변경 파일
- `domain/posts/entity/Post.kt`
- `domain/posts/repository/PostRepository.kt`
- `domain/posts/service/PostCommandService.kt`
- `domain/posts/service/PostQueryService.kt`
- `domain/posts/web/PostController.kt`

### 품질 검증
- [x] ktlintCheck 통과
- [x] compileKotlin 통과
- [x] verify-reactive 통과
- [x] 테스트 100% 통과

### PR
- PR #{pr_number}: {pr_title}
```

### Step 3: 이슈 업데이트

```bash
# 라벨 업데이트
gh issue edit {issue_number} --add-label "status:review-requested"
gh issue edit {issue_number} --remove-label "status:in-progress"

# 코멘트 추가
gh issue comment {issue_number} --body "$(cat <<'EOF'
## 구현 완료 🎉

{구현 요약}

@{po_username} 검토 부탁드립니다.
EOF
)"
```

## Output Format

### 완료

```markdown
[SEMO] Skill: complete-draft-task 완료

## Draft Task 완료 처리

### 이슈 업데이트
- 이슈: #{issue_number}
- 상태: `in-progress` → `review-requested`
- 라벨: `status:review-requested` 추가

### 코멘트 추가
✅ 구현 요약 코멘트 작성 완료

### PR 연결
- PR #{pr_number} → Issue #{issue_number}

## 다음 단계

PO가 검토 후:
1. **승인**: `status:approved` → Merge
2. **수정 요청**: 피드백 반영 후 재검토 요청
```

## Labels

| Label | 의미 |
|-------|------|
| `status:draft` | PO 초안 작성 중 |
| `status:ready` | 개발 시작 가능 |
| `status:in-progress` | 개발 진행 중 |
| `status:review-requested` | PO 검토 요청 |
| `status:approved` | PO 승인 완료 |

## Critical Rules

1. **검증 먼저**: `verify-implementation` 통과 후에만 실행
2. **요약 필수**: 구현 내용 요약 코멘트 필수
3. **PO 멘션**: 검토 요청 시 PO 멘션 필수

## References

- [Issue Workflow](references/issue-workflow.md)
- [Review Process](references/review-process.md)
