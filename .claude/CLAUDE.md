# semo — Claude Configuration

> SEMO v4.7.0 (2026-04-06)
> 공통 규칙(KB-First, 3자 동기화, KB CLI)은 `~/.claude/CLAUDE.md` 참조.

---

## SEMO란?

**SEMO (Semicolon Orchestrate)** 는 [OpenClaw 봇팀] ↔ [Core DB] ↔ [로컬 Claude Code 세션]의 3자 컨텍스트 동기화 시스템이다. 이 디렉토리는 SEMO 시스템 자체의 소스코드.

---

## Quality Gate

```bash
npm run lint && npx tsc --noEmit && npm run build
```

`--no-verify` 사용 금지. 브랜치: `dev` (기본, PR 타겟).

### CLI 배포 (팀 전파)

| 패키지 | npm 이름 | 배포 트리거 |
|--------|----------|------------|
| `packages/cli` | `@team-semicolon/semo-cli` | `dev` 브랜치 push 시 자동 배포 |
| `packages/mcp-kb` | `@team-semicolon/semo-mcp-kb` | Git tag `mcp-v*` |

---

## 상세 규칙 (필요 시 참조)

GFP 파이프라인 작업 시 → `.claude/rules/gfp-slack-first.md` (Slack-First 원칙)
PM 데이터 읽기/쓰기 시 → `.claude/rules/data-routing.md` (Data Routing)
빌드/배포 상세 → `.claude/rules/quality-gate.md` (CLI 배포 포함)
