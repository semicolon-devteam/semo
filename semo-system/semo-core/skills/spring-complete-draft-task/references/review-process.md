# Review Process Reference

## PO 검토 기준

### 기능 검증

| 항목 | 확인 사항 |
|------|----------|
| 요구사항 충족 | spec.md 대비 100% 구현 |
| API 스펙 일치 | OpenAPI 스펙과 일치 |
| 엣지 케이스 | 예외 상황 처리 |

### 품질 검증

| 항목 | 기준 |
|------|------|
| 테스트 커버리지 | ≥80% |
| 코드 스타일 | ktlint 통과 |
| Reactive 패턴 | .block() 없음 |

## 검토 결과 처리

### 승인 시

```bash
# PO가 승인 라벨 추가
gh issue edit 123 --add-label "status:approved"
gh issue edit 123 --remove-label "status:review-requested"

# PR 머지
gh pr merge 456 --squash
```

### 수정 요청 시

```markdown
## 수정 요청 📝

### 수정 필요 사항
1. [ ] PostController.getPost() - 404 처리 추가
2. [ ] CreatePostRequest - validation 추가

### 피드백
- 전체적으로 잘 구현되었습니다.
- 위 2가지 사항만 수정 부탁드립니다.
```

```bash
# 상태 복귀
gh issue edit 123 --add-label "status:in-progress"
gh issue edit 123 --remove-label "status:review-requested"
```

## 머지 후 처리

```bash
# 이슈 자동 닫힘 (PR에 Closes #123 있는 경우)

# 브랜치 삭제
git branch -d feature/123-posts-domain
git push origin --delete feature/123-posts-domain
```

## 검토 체크리스트

### 개발자 (PR 전)

- [ ] `skill:verify-implementation` 통과
- [ ] 모든 테스트 통과
- [ ] PR 설명 작성
- [ ] 이슈 연결 확인

### PO (검토 시)

- [ ] 요구사항 충족 확인
- [ ] API 스펙 일치 확인
- [ ] 테스트 커버리지 확인
- [ ] 코드 품질 확인
