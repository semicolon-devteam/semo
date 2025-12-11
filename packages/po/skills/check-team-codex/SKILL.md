---
name: check-team-codex
description: Validate code against Team Codex standards. Use when (1) before committing, (2) code review, (3) quality gate enforcement.
tools: [Bash, Read, Grep]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: check-team-codex 호출 - {검증 범위}` 시스템 메시지를 첫 줄에 출력하세요.

# Check Team Codex Skill

> 코드를 Semicolon 팀 표준에 맞게 자동 검증

## 규칙 참조 (SoT)

> **모든 Team Codex 규칙은 sax-core/TEAM_RULES.md에서 관리됩니다.**

```bash
# 로컬 참조
.claude/sax-core/TEAM_RULES.md

# 원격 참조
gh api repos/semicolon-devteam/sax-core/contents/TEAM_RULES.md --jq '.content' | base64 -d
```

**참조 섹션**:

- `2. Code Quality (Team Codex)` - 검증 항목, 금지 사항, Severity Levels
- `6. Quality Gates` - Pre-commit, Pre-PR 검증

## Quick Start

```bash
# Pre-commit 필수 체크
npm run lint && npx tsc --noEmit

# Pre-PR 전체 검증
npm run lint && npx tsc --noEmit && npm test
```

**기대 결과**:

- ✅ ESLint: 0 errors, 0 warnings
- ✅ TypeScript: 0 errors
- ✅ No debug code found

## When to Use

- Before committing code
- During code review
- After implementation (quality gate)
- Onboarding new team members

## Severity Levels

| Level | 항목 | 조치 |
|-------|------|------|
| 🔴 CRITICAL | ESLint/TS 에러, hook 우회, 아키텍처 위반 | PR 차단 |
| 🟡 WARNING | Debug 코드, any 타입, TODO 주석 | 수정 권장 |
| 🟢 INFO | 스타일 제안, 성능 힌트 | 선택적 |
