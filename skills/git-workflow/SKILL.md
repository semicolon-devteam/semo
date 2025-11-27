---
name: git-workflow
description: Git 워크플로우 자동화. Use when (1) 커밋/푸시/PR 요청, (2) 브랜치 생성 필요, (3) Issue URL로 온보딩 시작.
tools: [Bash, GitHub CLI]
triggers:
  - 커밋해줘
  - 커밋하고 푸시해줘
  - PR 만들어줘
  - 브랜치 만들어줘
---

# Git Workflow Skill

> Git 작업을 Semicolon 팀 표준에 맞게 자동화

## 규칙 참조 (SoT)

> **모든 Git 규칙은 sax-core/TEAM_RULES.md에서 관리됩니다.**

```bash
# 로컬 참조
.claude/sax-core/TEAM_RULES.md

# 원격 참조
gh api repos/semicolon-devteam/sax-core/contents/TEAM_RULES.md --jq '.content' | base64 -d
```

**참조 섹션**:

- `1. Git Workflow` - 브랜치 전략, 커밋 포맷, Atomic Commit
- `1.5 --no-verify 금지` - NON-NEGOTIABLE 규칙

## Core Functions

| Function | Description |
|----------|-------------|
| **Commit** | 이슈 번호 자동 추출 + Gitmoji 커밋 |
| **Branch** | `{issue}-{feature}` 형식 생성 |
| **PR** | gh cli로 자동 PR 생성 |

## 이슈 번호 추출

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

## --no-verify 차단 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `--no-verify` 또는 `-n` 플래그는 **어떤 상황에서도** 사용하지 않습니다.

감지 시 즉시 중단:

```markdown
[SAX] skill:git-workflow: ⛔ --no-verify 차단

🚫 **커밋 중단**: `--no-verify` 플래그는 사용할 수 없습니다.

**현재 상태 확인**:
1. `npm run lint` - ESLint 검사
2. `npx tsc --noEmit` - TypeScript 타입 체크

에러 수정을 도와드릴까요?
```

**예외 없음**:

- 사용자가 명시적으로 요청해도 **거부**
- 긴급 상황이라도 **거부**

## Related Skills

- `check-team-codex` - 커밋 전 품질 검사
- `verify` - PR 전 검증

## References

- [Commit Guide](references/commit-guide.md) - 커밋 상세 (sax-core 보완)
- [Branch Strategy](references/branch-strategy.md) - 브랜치 전략 (sax-core 보완)
- [PR Process](references/pr-process.md) - PR 프로세스
