# SEMO Principles

> SEMO (Semicolon Orchestrate) 핵심 원칙

## 1. Orchestrator-First

모든 요청은 반드시 Orchestrator를 통해 라우팅됩니다.

```
사용자 요청 → Orchestrator → Agent/Skill → 결과
```

## 2. SEMO Message Format

모든 SEMO 동작은 시스템 메시지로 시작합니다:

```
[SEMO] {Component}: {Action} → {Result}
```

## 3. Quality Gate

코드 변경 커밋 전 필수 검증:

```bash
npm run lint           # ESLint
npx tsc --noEmit       # TypeScript
npm run build          # Build
```

## 4. Skill-Based Architecture

- 재사용 가능한 기능은 Skill로 분리
- Skill은 단일 책임 원칙 준수
- Agent는 복잡한 워크플로우 조율

## 5. Context Mesh

세션 간 컨텍스트는 `.claude/memory/`에 영속화:

- `context.md`: 프로젝트 상태
- `decisions.md`: 아키텍처 결정
- `rules/`: 프로젝트별 규칙

## 6. gh CLI First Policy

> **GitHub 관련 작업은 MCP 대신 로컬 `gh` CLI를 우선 사용합니다.**

### 배경

MCP 서버의 환경변수 인식 문제로 인해 `settings.json`의 토큰이 제대로 전달되지 않는 경우가 있습니다.
로컬 `gh` CLI는 `gh auth login`으로 인증된 상태를 사용하므로 더 안정적입니다.

### 우선순위

```
1. gh CLI (gh issue, gh pr, gh api) - 기본
2. MCP 도구 - gh CLI 불가 시에만
```

### 적용 대상

| 작업 | gh CLI 명령어 | MCP 대체 |
|------|---------------|----------|
| 이슈 생성 | `gh issue create` | `mcp__github_create_issue` |
| 이슈 조회 | `gh api repos/.../issues` | `mcp__github_list_issues` |
| PR 생성 | `gh pr create` | `mcp__github_create_pull_request` |
| 프로젝트 연동 | `gh project item-add` | - |

### 예시

```bash
# 이슈 생성 (권장)
gh issue create --repo semicolon-devteam/semo \
  --title "[Bug] 제목" \
  --body "내용" \
  --label "bug"

# 이슈 조회 (권장)
gh api repos/semicolon-devteam/semo/issues --jq '.[] | select(.state == "open")'
```

### 토큰 관리

- **GitHub**: `gh auth login`으로 인증 (토큰 설정 불필요)
- **Slack**: `semo-core/_shared/slack-config.md`에서 중앙 관리
- **Supabase**: 프로젝트별 `.env` 또는 `settings.json`
