# semo — Claude Configuration

> SEMO v4.8.0 (2026-04-15) — services/service\_\* 13개 테이블 KB 이식 완료
> 공통 규칙(KB-First, 3자 동기화, KB CLI)은 `~/.claude/CLAUDE.md` 참조.

---

## SEMO란?

**SEMO (Semicolon Orchestrate)** 는 [Agent SDK Orchestrator] ↔ [Core DB] ↔ [Slack Gateway + Channel Plugins]의 3자 컨텍스트 동기화 시스템이다. 이 디렉토리는 SEMO 시스템 자체의 소스코드.

---

## Quality Gate

```bash
npm run lint && npx tsc --noEmit && npm run build
```

커밋 시 항상 pre-commit 훅을 통과시킨다. 브랜치: `dev` (기본, PR 타겟).

### CLI 배포 (팀 전파)

| 패키지              | npm 이름                      | 배포 트리거                                |
| ------------------- | ----------------------------- | ------------------------------------------ |
| `packages/cli`      | `@team-semicolon/semo-cli`    | Git tag `cli-v*` 또는 `workflow_dispatch`  |
| `packages/cli-core` | `@team-semicolon/semo-core`   | Git tag `core-v*` 또는 `workflow_dispatch` |
| `packages/cli-solo` | `@team-semicolon/semo-solo`   | Git tag `solo-v*` 또는 `workflow_dispatch` |
| `packages/mcp-kb`   | `@team-semicolon/semo-mcp-kb` | Git tag `mcp-v*`                           |

`dev` push 는 dashboard Docker 빌드만 돌린다. CLI 배포 절차는 `.claude/rules/quality-gate.md` 참조.

---

## No Hardcoded Bot Lists (NON-NEGOTIABLE)

봇 목록, 위임 대상, 디스패치 테이블 등을 **로컬 파일에 하드코딩하지 않는다.** DB(`semo.bot_status`, `semo.bot_delegation`)가 SoT이며, 로컬 파일은 `semo onboarding` 또는 `semo context sync` 시 DB에서 동적 생성된다.

- 봇 추가/제거 → DB 테이블 수정 → `semo onboarding -f`로 로컬 반영
- SOUL.md, CLAUDE.md의 봇 테이블은 `generateSoulMd()` 등이 DB에서 동적 생성
- 에이전트 정의(`~/.claude/agents/`)는 DB `agent_definitions`에서 동기화

**위반 예시**: SOUL.md에 `| PlanClaw | planclaw |` 같은 정적 테이블 직접 삽입
**올바른 방법**: `getDelegations()` → 템플릿에 `${dispatchTable}` 변수로 주입

---

## Cron 실행 마감 (NON-NEGOTIABLE)

Cron 트리거로 실행한 작업은 종료 시점에 반드시 `semo cron mark-run --bot-id ... --job-id ... --status ... --started-at ... --duration-ms ...` 를 호출한다. 이 호출이 `bot_commitments(source_type='cron')` 한 행을 마감 상태로 INSERT하고 `bot_cron_jobs` rollup(`last_status`, `consecutive_failures`)을 갱신한다. 누락 시 24h 후 stale_auto로 reap 되지만 그동안 다음 실행이 막힌다.

---

## 상세 규칙 (필요 시 참조)

PM 데이터 읽기/쓰기 시 → `.claude/rules/data-routing.md` (Data Routing)
빌드/배포 상세 → `.claude/rules/quality-gate.md` (CLI 배포 포함)
세션 동기화 → `.claude/rules/session-sync.md` (로컬↔Agent SDK 동기화)
