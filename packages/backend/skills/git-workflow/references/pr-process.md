# PR Process Reference

## PR Creation

```bash
gh pr create --title "✨ #35 Add post API" \
  --body "## Summary
- Add POST /api/v1/posts endpoint
- Add GET /api/v1/posts/{id} endpoint

## Related
- Related #35

## Checklist
- [x] Tests added
- [x] ktlint passed
- [x] No .block() calls"
```

## PR Template

```markdown
## Summary
{변경 사항 요약}

## Related
- Related #{issue_number}

## Checklist
- [ ] Tests added
- [ ] ktlint passed
- [ ] Compile successful
- [ ] No .block() calls
- [ ] CQRS pattern followed
```

## Review Process

1. PR 생성
2. CI 통과 확인
3. 코드 리뷰 요청
4. 승인 후 Squash Merge

## Merge Rules

- Squash and Merge 권장
- main에 직접 push 금지
- CI 통과 필수

## PR 머지 후 자동 처리

PR이 머지되면 연결된 이슈의 Project Status를 **테스트중**으로 변경:

```bash
# PR 본문에서 이슈 번호 추출
ISSUE_NUM=$(gh pr view --json body --jq '.body' | grep -oE 'Related #[0-9]+' | grep -oE '[0-9]+')

# Project Status 변경 (테스트중)
# → 백엔드는 QA 할당 없이 담당 엔지니어가 테스트 진행
```

**출력**:

```markdown
[SEMO] skill:git-workflow: PR 머지 완료

✅ **PR #42**: `✨ #35 Add post API` → main 병합 완료

📋 **이슈 상태 변경**:
- 이슈: #35
- 상태: 작업중 → **테스트중**
- Project: 이슈카드

다음 단계: 담당 엔지니어가 테스트 코드로 검증 진행
```

> **ℹ️ 프론트엔드와의 차이**: 프론트엔드(semo-next)는 테스트중 상태 시 QA(@kokkh)가 자동 할당되지만, 백엔드는 담당 엔지니어가 테스트 코드로 직접 검증합니다.
