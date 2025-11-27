# PR Process

> **SoT 참조**: Quality Gates는 `sax-core/TEAM_RULES.md` 섹션 6에서 관리됩니다.

## Pull Request Creation

**자동 PR 생성 워크플로우**:

```bash
# 1. 현재 브랜치 푸시
git push -u origin $(git branch --show-current)

# 2. PR 생성 (gh cli)
gh pr create \
  --title "✨ #${ISSUE_NUM} ${PR_TITLE}" \
  --body "$(cat <<'EOF'
## Summary
- [변경 사항 요약]

## Related Issue
- Closes #${ISSUE_NUM}

## Test Plan
- [ ] 테스트 항목 1
- [ ] 테스트 항목 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Pre-commit Checks

커밋 전 자동 실행:

```bash
npm run lint      # ESLint 검사
npx tsc --noEmit  # TypeScript 검사
```

**실패 시**:

```markdown
❌ 커밋 전 검사 실패

**ESLint 오류**: 2개
- src/app/posts/page.tsx:15:3 - 'unused' is defined but never used

**수정 후 다시 시도해주세요.**
```

## Error Handling

### No Changes to Commit

```markdown
ℹ️ 커밋할 변경 사항이 없습니다.

현재 상태:
- 브랜치: `35-comment-ui`
- Working tree clean
```

### Uncommitted Changes Before Branch Switch

```markdown
⚠️ 커밋되지 않은 변경 사항이 있습니다.

옵션:
1. 변경 사항 커밋 후 브랜치 전환
2. 변경 사항 스태시 후 브랜치 전환 (git stash)
3. 변경 사항 폐기 후 브랜치 전환 (⚠️ 데이터 손실)

선택:
```

### Push Rejected

```markdown
❌ 푸시가 거부되었습니다.

원인: 원격 브랜치에 새로운 커밋이 있습니다.

해결 방법:
1. git pull --rebase origin $(git branch --show-current)
2. 충돌 해결 (필요시)
3. git push

자동으로 pull --rebase 실행할까요? (Y/n)
```

## Usage Examples

### Example 1: Simple Commit

```markdown
User: 커밋해줘

Skill Response:
📋 **현재 상태**
- 브랜치: `35-comment-ui`
- 이슈 번호: `#35`
- 변경 파일: 2개

📝 **제안 커밋 메시지**:
✨ #35 Add CommentList component

진행할까요? (Y/n)
```

### Example 2: Commit with Push

```markdown
User: 커밋하고 푸시해줘

Skill Response:
📋 **현재 상태**
- 브랜치: `001-dynamic-gnb-menus`
- 이슈 번호: `#001`
- 변경 파일: 1개

📝 **커밋 메시지**:
📝 #001 Update GNB spec documentation

🚀 **실행 계획**:
1. git add .
2. git commit -m "📝 #001 Update GNB spec documentation"
3. git push

진행할까요? (Y/n)
```

### Example 3: Create PR

```markdown
User: PR 만들어줘

Skill Response:
📋 **현재 상태**
- 브랜치: `35-comment-ui`
- Base: `dev`
- 커밋 수: 5개
- 이슈: `#35`

📝 **PR 정보**:
- Title: `✨ #35 댓글 UI 구현`
- Labels: `feature`, `frontend`

🚀 **실행 계획**:
1. git push -u origin 35-comment-ui
2. gh pr create --title "..." --body "..."

진행할까요? (Y/n)
```

### Example 4: Issue Onboarding

```markdown
User: https://github.com/semicolon-devteam/cm-office/issues/132 이거 할당받았는데, 뭐부터 하면 돼?

Skill Response:
## 🚀 Issue Onboarding: #132

**이슈 정보**:
- Repository: `cm-office`
- Issue: #132
- Title: `User Profile Upload`

---

### ✅ Step 1: 브랜치 확인
현재 브랜치: `dev` ✅

### ✅ Step 2: 소스 최신화
```bash
git pull origin dev
```

### ✅ Step 3: 피처 브랜치 생성
```bash
git checkout -b 132-user-profile-upload
```

### 🎯 Step 4: 다음 단계
브랜치 생성 후 Speckit 워크플로우를 시작하세요:
1. `/speckit.specify` - 명세 작성
2. `/speckit.plan` - 계획 수립
3. `/speckit.tasks` - 태스크 분해
4. `/speckit.implement` - 구현

진행할까요? (Y/n)
```

## Related Skills

- `implementation-master` - 구현 시 커밋 전략 참조
- `check-team-codex` - 커밋 전 품질 검사
- `verify` - PR 전 검증

## Critical Rules

1. **이슈 번호 필수**: 브랜치에 이슈 번호가 있으면 반드시 커밋 메시지에 포함
2. **Gitmoji 사용**: 커밋 타입에 맞는 이모지 사용
3. **Atomic Commit**: 5개 이상 파일 변경 시 분할 제안
4. **Pre-commit 준수**: lint/typecheck 통과 필수
5. **NEVER --no-verify**: 절대 pre-commit hook 우회 금지
