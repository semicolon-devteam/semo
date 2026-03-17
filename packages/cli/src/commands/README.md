# Commands

`semo` CLI의 서브커맨드 모듈들.

## 파일 목록

| 파일 | 커맨드 | 역할 |
|------|--------|------|
| `bots.ts` | `semo bots` | 봇 상태 관리 (`status`, `seed`, `sync`) |
| `context.ts` | `semo context` | Core DB ↔ `.claude/memory/` 동기화 (`sync`, `push`) |
| `skill-sync.ts` | _(내부 모듈)_ | 스킬 파일 스캔 + DB 동기화 — 직접 호출하지 않음 |
| `sessions.ts` | `semo sessions` | 봇 세션 추적 |
| `audit.ts` | `semo audit` | Bot workspace 표준 구조 감사 |
| `get.ts` | `semo get` | 세션 중 실시간 DB 쿼리 |
| `db.ts` | `semo db` | 마이그레이션 관리 |

## 스킬 동기화 흐름

`skill-sync.ts`는 공통 모듈로, 두 곳에서 호출됩니다:

```
semo bots sync   → bots.ts → syncSkillsToDB()
semo context sync → context.ts → syncSkillsToDB()
```

스캔 대상:
- **공유 스킬**: `semo-system/semo-skills/*/SKILL.md`
- **봇 전용 스킬**: `semo-system/bot-workspaces/{봇}/skills/*/SKILL.md`

## 주요 커맨드 차이

| 커맨드 | 용도 |
|--------|------|
| `semo bots seed` | 봇 7개를 `bot_status`에 초기 등록 (최초 1회) |
| `semo bots sync` | 봇 상태 + 스킬 동기화 (정기 실행) |
| `semo context sync` | Core DB → 로컬 memory 동기화 + 스킬 동기화 (세션 시작 훅) |

## `target_agents` 시딩 규칙

`skill_definitions.target_agents`는 `TEXT[]` 컬럼:

- 공유 스킬 → DEFAULT `'{all}'` (모든 봇이 사용)
- 봇 전용 스킬 → `'{botId}'` (해당 봇만 사용, 예: `'{workclaw}'`)
