---
name: git-workflow
description: Git 워크플로우 자동화. Use when (1) 커밋/푸시/PR 요청, (2) 브랜치 생성 필요, (3) Issue URL로 온보딩 시작, (4) Git 관련 작업 요청 시.
tools: [Bash, GitHub CLI]
triggers:
  - 커밋해줘
  - 커밋하고 푸시해줘
  - PR 만들어줘
  - 브랜치 만들어줘
  - 푸시해줘
  - "{Issue URL} 할당받았는데"
  - "{Issue URL} 시작하려는데"
  - "{이슈번호}번 이슈로 브랜치 만들어줘"
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: git-workflow 호출 - {작업 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# Git Workflow Skill

Git 작업을 Semicolon 팀 표준에 맞게 자동화합니다.

## Quick Start

### Activation Triggers

- `커밋해줘` / `커밋하고 푸시해줘`
- `PR 만들어줘` / `풀리퀘스트 생성해줘`
- `브랜치 만들어줘` / `새 브랜치`
- `{GitHub Issue URL} 할당받았는데, 뭐부터 하면 돼?`

### Core Functions

| Function | Description |
|----------|-------------|
| **Commit** | 이슈 번호 자동 추출 + Gitmoji 커밋 메시지 |
| **Branch** | `{issue}-{feature}` 형식 브랜치 생성 |
| **PR** | gh cli로 자동 PR 생성 |
| **Onboarding** | Issue URL → 브랜치 생성 → Speckit 가이드 |

## Commit Format

**형식**: `:gitmoji: #issue-number subject`

| Gitmoji | Type | 사용 시점 |
|---------|------|-----------|
| ✨ | feat | 새 기능 추가 |
| 🐛 | fix | 버그 수정 |
| 🔧 | chore | 설정, 구조 변경 |
| ✅ | test | 테스트 추가/수정 |
| ♻️ | refactor | 리팩토링 |
| 📝 | docs | 문서 작성/수정 |

## Branch Format

**형식**: `{issue-number}-{feature-name}`

| 유형 | 패턴 | 예시 |
|------|------|------|
| Feature | `{issue}-{feature}` | `35-comment-ui` |
| Fix | `fix/{issue}-{description}` | `fix/42-login-redirect` |

## Critical Rules

1. **이슈 번호 필수**: 브랜치명에서 자동 추출 → 커밋에 포함
2. **Gitmoji 사용**: 타입에 맞는 이모지 필수
3. **Atomic Commit**: 5개 이상 파일 → 분할 커밋 제안
4. **Pre-commit 준수**: lint/typecheck 통과 필수
5. **NEVER --no-verify**: pre-commit hook 우회 **절대 금지**

## --no-verify 차단 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `--no-verify` 또는 `-n` 플래그는 **어떤 상황에서도** 사용하지 않습니다.

### 차단 동작

`--no-verify` 감지 시 **즉시 중단**하고 다음 메시지 출력:

```markdown
[SAX] skill:git-workflow: ⛔ --no-verify 차단

🚫 **커밋 중단**: `--no-verify` 플래그는 사용할 수 없습니다.

**사유**: Pre-commit hook 우회는 코드 품질을 저하시킵니다.

**현재 상태 확인**:
1. `npm run lint` - ESLint 검사
2. `npx tsc --noEmit` - TypeScript 타입 체크

에러 수정을 도와드릴까요?
```

### 예외 없음

- 사용자가 명시적으로 요청해도 **거부**
- 긴급 상황이라도 **거부**
- 유일한 예외: 사용자가 "hook 우회 허용" 설정을 명시적으로 활성화한 경우 (기본값: 비활성화)

## Related

- [Commit Guide](references/commit-guide.md)
- [Branch Strategy](references/branch-strategy.md)
- [PR Process](references/pr-process.md)

## Related Skills

- `implementation-master` - 구현 시 커밋 전략
- `check-team-codex` - 커밋 전 품질 검사
- `verify` - PR 전 검증
