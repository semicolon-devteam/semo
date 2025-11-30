# PR Process Reference

## PR Creation

```bash
gh pr create --title "✨ #35 Add post API" \
  --body "## Summary
- Add POST /api/v1/posts endpoint
- Add GET /api/v1/posts/{id} endpoint

## Related
- Closes #35

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
- Closes #{issue_number}

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
