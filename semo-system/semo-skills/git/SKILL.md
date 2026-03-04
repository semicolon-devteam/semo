---
name: git
description: |
  Git 워크플로우 자동화. Use when (1) "커밋해줘", "푸시해줘",
  (2) "PR 만들어줘", (3) "브랜치 만들어줘".
tools: [Bash, Read, Write]
model: inherit
---

> **🔔 호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: git-workflow` 시스템 메시지를 첫 줄에 출력하세요.

# git-workflow Skill

> Git 커밋, 푸시, PR 생성 자동화

## 🔴 Extension 우선 라우팅

> **Extension 패키지가 설치되어 있으면 해당 패키지의 git-workflow 스킬이 우선 호출됩니다.**

| Extension | 추가 기능 | 우선도 |
|-----------|----------|--------|
| `eng/nextjs` | Project Board 연동, Issue 상태 변경 | 1 |
| `eng/spring` | Project Board 연동 | 2 |
| (없음) | 이 스킬 (기본) | 3 |

---

## Core Functions

| Function | Description |
|----------|-------------|
| **Commit** | 이슈 번호 자동 추출 + Gitmoji 커밋 |
| **Push** | 원격 저장소에 푸시 |
| **Branch** | `{issue}-{feature}` 형식 생성 |
| **PR** | gh cli로 Draft PR 생성 |

---

## Workflow

### 1. Commit

```bash
# 이슈 번호 추출 (브랜치명에서)
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)

# 스테이징
git add .

# 커밋 (Gitmoji + 이슈 번호)
git commit -m "{gitmoji} {message} (#${ISSUE_NUM})"
```

### 2. Push

```bash
git push origin $(git branch --show-current)
```

### 3. Branch

```bash
# 형식: {issue번호}-{feature명}
git checkout -b {issue}-{feature}
```

### 4. PR

```bash
gh pr create --draft \
  --title "{title}" \
  --body "Related #{issue}"
```

---

## 🔴 --no-verify 차단 (NON-NEGOTIABLE)

> **⚠️ `--no-verify` 플래그는 어떤 상황에서도 사용하지 않습니다.**

감지 시 즉시 중단:

```markdown
[SEMO] Skill: git-workflow → ⛔ 차단

🚫 **커밋 중단**: `--no-verify` 플래그는 사용할 수 없습니다.

**현재 상태 확인**:
1. `npm run lint` - ESLint 검사
2. `npx tsc --noEmit` - TypeScript 타입 체크

에러 수정을 도와드릴까요?
```

**예외 없음**: 사용자가 명시적으로 요청해도 거부

---

## 🔴 PR 본문 - Related 사용 (NON-NEGOTIABLE)

> **⚠️ PR 본문에서 이슈 연결 시 `Closes` 대신 반드시 `Related`를 사용합니다.**

| 키워드 | 사용 여부 | 이유 |
|--------|----------|------|
| `Closes #이슈` | ❌ 금지 | 머지 시 이슈 자동 종료 |
| `Fixes #이슈` | ❌ 금지 | 머지 시 이슈 자동 종료 |
| **`Related #이슈`** | ✅ 필수 | 이슈 연결만, 자동 종료 안 됨 |

---

## 출력 형식

### 커밋 완료

```markdown
[SEMO] Skill: git-workflow → 커밋 완료

✅ **커밋**: {commit_message}
📁 **변경 파일**: {file_count}개
🔗 **이슈**: #{issue_number}

---

💡 **다음 단계**: 푸시할까요?
   - "푸시해줘" → 원격 저장소에 푸시
   - "PR 만들어줘" → Draft PR 생성
```

### PR 생성 완료

```markdown
[SEMO] Skill: git-workflow → PR 생성 완료

✅ **PR**: {pr_title}
🔗 **URL**: {pr_url}
📋 **Related**: #{issue_number}
```

---

## Related Skills

| Skill | 역할 | 연결 시점 |
|-------|------|----------|
| `implement` | 코드 작성/수정 | 커밋 전 |
| `tester` | 테스트 작성 | 커밋 전 |
| `project-board` | 이슈 상태 변경 | PR 생성 시 (Extension) |

---

## References

- [Commit Convention](../../semo-core/_shared/commit-convention.md) - 커밋 메시지 규칙
