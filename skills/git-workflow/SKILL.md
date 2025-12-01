---
name: git-workflow
description: Git 워크플로우 자동화. Use when (1) 커밋/푸시/PR 요청, (2) 브랜치 생성 필요.
tools: [Bash, GitHub CLI]
triggers:
  - 커밋해줘
  - 커밋하고 푸시해줘
  - PR 만들어줘
  - 브랜치 만들어줘
---

# Git Workflow Skill

@./../_shared/commit-guide.md
@./../_shared/quality-gates.md

> Git 작업을 Semicolon 팀 표준에 맞게 자동화

## 규칙 참조 (SoT)

> **모든 Git 규칙은 sax-core/TEAM_RULES.md에서 관리됩니다.**

```bash
.claude/sax-core/TEAM_RULES.md
```

**참조 섹션**:
- `1. Git Workflow` - 브랜치 전략, 커밋 포맷
- `1.5 --no-verify 금지` - NON-NEGOTIABLE 규칙

## Core Functions

| Function | Description |
|----------|-------------|
| **Commit** | 이슈 번호 자동 추출 + Gitmoji 커밋 |
| **Branch** | `{issue}-{feature}` 형식 생성 |
| **PR** | gh cli로 Draft PR 생성 |

## 이슈 번호 추출

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

## Backend Pre-commit

```bash
# 커밋 전 필수 실행
./gradlew ktlintCheck && ./gradlew compileKotlin
```

## --no-verify 차단 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `--no-verify` 또는 `-n` 플래그는 **어떤 상황에서도** 사용하지 않습니다.

감지 시 즉시 중단:

```markdown
[SAX] skill:git-workflow: ⛔ --no-verify 차단

🚫 **커밋 중단**: `--no-verify` 플래그는 사용할 수 없습니다.

**현재 상태 확인**:
1. `./gradlew ktlintCheck` - 코드 스타일 검사
2. `./gradlew compileKotlin` - 컴파일 검사

에러 수정을 도와드릴까요?
```

## Commit Message Format

```text
:gitmoji: #issue-number subject
```

| Gitmoji | Type | Use |
|---------|------|-----|
| ✨ | feat | 새 기능 |
| 🐛 | fix | 버그 수정 |
| 🔧 | chore | 설정 변경 |
| ✅ | test | 테스트 |
| ♻️ | refactor | 리팩토링 |
| 📦 | data | Entity, DTO |
| 🏗️ | arch | 구조 변경 |

## Output Format

### 커밋 성공

```markdown
[SAX] Skill: git-workflow 실행

## ✅ 커밋 완료

**Branch**: 35-post-api
**Commit**: ✨ #35 Add post creation endpoint
**Files**: 5 changed

**다음 단계**:
- `git push` - 원격에 푸시
- PR 생성 필요 시 "PR 만들어줘"
```

### PR 생성

```markdown
[SAX] Skill: git-workflow 실행

## ✅ PR 생성 완료

**Title**: ✨ #35 Add post API
**Branch**: 35-post-api → main
**URL**: https://github.com/semicolon-devteam/core-backend/pull/XX

**Related**: #35
```

## 프로젝트 보드 날짜 속성 설정

> **📖 상세 API**: sax-next/skills/project-board 참조

| 상태 변경 | 설정 속성 | 시점 |
|----------|----------|------|
| → **작업중** | `시작일` | 작업 시작 시 |
| → **리뷰요청** | `종료일` | dev 머지 및 리뷰 요청 시 |

### PR 머지 후 종료일 설정

```bash
# dev 머지 완료 후 리뷰요청 상태 + 종료일 설정
TODAY=$(date +%Y-%m-%d)

# 1. 상태 변경 (작업중 → 리뷰요청)
# 2. 종료일 설정 (오늘 날짜)

# skill:project-board 호출
skill: project-board({
  repo: "{repo}",
  issue_number: {issue_number},
  target_status: "리뷰요청"
})
# → 자동으로 종료일도 함께 설정됨
```

## Related Skills

- `check-team-codex` - 커밋 전 품질 검사
- `verify-reactive` - Reactive 패턴 검증

## References

- [Branch Strategy](references/branch-strategy.md)
- [PR Process](references/pr-process.md)
