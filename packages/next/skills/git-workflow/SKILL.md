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

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: git-workflow 호출 - {작업 유형}` 시스템 메시지를 첫 줄에 출력하세요.

# Git Workflow Skill

@./../_shared/commit-guide.md
@./../_shared/quality-gates.md

> Git 작업을 Semicolon 팀 표준에 맞게 자동화

## 규칙 참조 (SoT)

> **모든 Git 규칙은 semo-core/TEAM_RULES.md에서 관리됩니다.**

```bash
# 로컬 참조
.claude/semo-core/TEAM_RULES.md

# 원격 참조
gh api repos/semicolon-devteam/semo-core/contents/TEAM_RULES.md --jq '.content' | base64 -d
```

**참조 섹션**:

- `1. Git Workflow` - 브랜치 전략, 커밋 포맷, Atomic Commit
- `1.5 --no-verify 금지` - NON-NEGOTIABLE 규칙

## Core Functions

| Function | Description |
|----------|-------------|
| **Commit** | 이슈 번호 자동 추출 + Gitmoji 커밋 |
| **Branch** | `{issue}-{feature}` 형식 생성 |
| **PR** | gh cli로 Draft PR 생성 (`Related #이슈`) |
| **Status** | Project 이슈카드 상태 자동 변경 → `skill:project-board` 호출 |

## Project 상태 관리

> **🔴 CRITICAL**: 이슈 상태 변경 시 Labels가 아닌 **Projects 보드 Status 필드**를 변경해야 합니다.

### 상태 변경 요청 처리

사용자가 "리뷰요청 상태로 만들어줘", "작업중으로 변경해줘" 등 요청 시:

1. **Labels 변경 금지** - Projects Status 변경이 의도임
2. **`skill:project-board` 호출** - 실제 상태 변경 처리
3. 프로젝트 미연결 시 자동 추가 후 상태 변경

```markdown
[SEMO] skill:git-workflow: 상태 변경 요청 감지

📋 **이슈**: {repo}#{number}
🔄 **요청 상태**: {target_status}

→ skill:project-board 호출
```

### 자동 상태 변경 시점

| 시점 | 상태 변경 | 처리 방법 |
|------|----------|----------|
| 작업 시작 | → **작업중** | `skill:project-board` 호출 |
| PR 머지 | → **테스트중** | `skill:project-board` 호출 |

**상세**: [Project Status](references/project-status.md)

## 이슈 번호 추출

```bash
ISSUE_NUM=$(git branch --show-current | grep -oE '^[0-9]+|/[0-9]+' | grep -oE '[0-9]+' | head -1)
```

## 🔴 Pre-Commit Quality Gate (NON-NEGOTIABLE)

> **CRITICAL**: 모든 커밋 전 반드시 Quality Gate를 통과해야 합니다.

### 커밋 전 필수 검증 순서

```bash
# 1. ESLint 검사
npm run lint

# 2. TypeScript 타입 체크
npx tsc --noEmit

# 3. (Next.js 프로젝트) 빌드 검증
npm run build
```

### 검증 실패 시 커밋 차단

```markdown
[SEMO] skill:git-workflow: ⛔ Quality Gate 실패

🚫 **커밋 차단**: 품질 검증을 통과하지 못했습니다.

**실패 항목**:
- [ ] ESLint: {pass/fail} ({error_count} errors)
- [ ] TypeScript: {pass/fail} ({error_count} errors)
- [ ] Build: {pass/fail}

**다음 단계**:
1. 위 에러들을 먼저 수정하세요
2. 수정 후 다시 커밋을 요청하세요

에러 수정을 도와드릴까요?
```

### 검증 성공 시 진행

```markdown
[SEMO] skill:git-workflow: ✅ Quality Gate 통과

**검증 결과**:
- [x] ESLint: pass
- [x] TypeScript: pass
- [x] Build: pass

커밋을 진행합니다...
```

### 예외 케이스 (Quality Gate 생략 가능)

| 케이스 | 조건 | 검증 범위 |
|--------|------|----------|
| 문서만 변경 | `*.md` 파일만 변경 | 생략 가능 |
| 설정 파일만 | `.json`, `.yaml` 등 | lint만 실행 |
| SEMO 파일만 | `.claude/` 내부만 변경 | 생략 가능 |

> **🔴 중요**: src/ 또는 app/ 내 코드 변경이 있으면 **반드시** 전체 검증 실행

## --no-verify 차단 (NON-NEGOTIABLE)

> **🔴 CRITICAL**: `--no-verify` 또는 `-n` 플래그는 **어떤 상황에서도** 사용하지 않습니다.

감지 시 즉시 중단:

```markdown
[SEMO] skill:git-workflow: ⛔ --no-verify 차단

🚫 **커밋 중단**: `--no-verify` 플래그는 사용할 수 없습니다.

**사유**: Pre-commit Quality Gate는 코드 품질을 보장합니다.

**해결 방법**:
1. `npm run lint` 실행 후 에러 수정
2. `npx tsc --noEmit` 실행 후 타입 에러 수정
3. `npm run build` 실행 후 빌드 에러 수정
4. 에러 수정 후 다시 커밋 요청

에러 수정을 도와드릴까요?
```

**예외 없음**:

- 사용자가 명시적으로 요청해도 **거부**
- 긴급 상황이라도 **거부**
- "빨리 해야 해", "나중에 고칠게" 등 **모두 거부**

## Related Skills

- `check-team-codex` - 커밋 전 품질 검사
- `verify` - PR 전 검증
- `project-board` - Projects 상태 변경

## References

- [Branch Strategy](references/branch-strategy.md) - 브랜치 전략
- [PR Process](references/pr-process.md) - PR 프로세스
- [Project Status](references/project-status.md) - 이슈 상태 관리
