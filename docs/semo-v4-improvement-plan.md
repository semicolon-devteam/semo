# SEMO v4 종합 개선 플랜

## Context

SEMO v4는 PostgreSQL을 SSoT로 7개 봇 + 로컬 Claude Code 세션 간 컨텍스트를 동기화하는 CLI 시스템이다. 설계 의도는 명확하지만, CLI 구현·DB 스키마·봇 훅 세 영역에 걸쳐 "동작은 하지만 설계대로 동작하지 않는" 갭이 존재한다. 본 플랜은 신규 기능 추가 없이 기존 설계를 올바르게 작동시키는 데 집중한다.

---

## 핵심 파일 경로

| 역할          | 경로                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| CLI 소스      | `/Users/reus/Desktop/Sources/semicolon/projects/semo/packages/cli/src/` |
| CLI 빌드 결과 | `/Users/reus/.local/lib/node_modules/@team-semicolon/semo-cli/dist/`    |
| 봇 훅 (×7)    | `semo-system/bot-workspaces/{bot}/hooks/semo-bot-status/handler.ts`     |
| DB 초기화     | `/Users/reus/workspace/core-central-db/init/`                           |

---

## P0 — 즉시: 잘못된 상태를 만드는 버그

### P0-1: `bots sync`가 온라인 봇 상태를 덮어쓸 위험

**문제:** `bots.ts`의 `INSERT ... ON CONFLICT DO UPDATE`에서 `status` 컬럼을 보존하는 명시적 처리가 없다. 미래에 충돌 절이 수정될 경우, 훅이 `online`으로 set한 봇을 `bots sync`가 `offline`으로 덮어쓸 수 있다.

**수정:** ON CONFLICT DO UPDATE SET에 `status = semo.bot_status.status` 명시적으로 추가. sync는 metadata(name/emoji/role/workspace_path)만 갱신하고, status는 항상 기존 값 보존.

**파일:** `packages/cli/src/commands/bots.ts`

---

### P0-2: `context push` 파서가 decision 도메인 외에도 적용됨

**문제:** `parseDecisionsMarkdown`은 `## Title\ncontent` 포맷 전용이다. 그런데 `--domain team`으로 실행하면 `team.md`(테이블 포맷)를 이 파서로 처리해 KB를 오염시킨다.

**수정:** `context push`에서 `--domain` 값을 `decision`으로 제한하는 가드 추가. 다른 도메인은 명시적 오류 메시지와 함께 거부.

**파일:** `packages/cli/src/commands/context.ts`

---

### P0-3: `session_count` 경쟁 조건

**문제:** `sessions sync`와 `sessions push`가 각자 독립적으로 `session_count = (SELECT COUNT(*) ...)` 업데이트를 실행. 7개 봇을 순차 처리하는 루프에서 트랜잭션 경계 밖에 있어 카운트가 틀릴 수 있다.

**수정 (단기):** `session_count` 업데이트를 개별 세션 upsert 직후 같은 트랜잭션 안에서 실행.
**수정 (중기):** `semo.bot_sessions` INSERT/DELETE 트리거로 `bot_status.session_count` 자동 유지 (마이그레이션 시스템 구축 후 적용).

**파일:** `packages/cli/src/commands/sessions.ts`

---

## P1 — 단기: 설계 의도는 있으나 구현이 빠진 항목

### P1-1: 마이그레이션 시스템 부재

**문제:** DB 스키마가 ad-hoc 적용 중. P0-3 트리거, P1-2 인덱스, FK 등 모든 DB 개선의 배포 경로가 없다.

**수정:** `semo db migrate` 커맨드 신규 구현.

- `semo.schema_migrations(version TEXT PK, applied_at TIMESTAMPTZ)` 테이블로 상태 추적
- `migrations/` 디렉터리의 순번 SQL 파일(`001_initial.sql`, `002_add_indexes.sql` …)을 순서대로 적용
- 기존 스키마 DDL을 `001_initial.sql`로 문서화

**파일:** `packages/cli/src/commands/db.ts` (신규), `migrations/` 디렉터리 (신규)

---

### P1-2: 누락된 DB 인덱스

**문제:** 매 `context sync`마다 `domain` 필터, 매 `bots sessions`마다 `last_activity` 정렬이 풀 스캔으로 실행. 벡터 검색도 IVFFlat 인덱스 없이 순차 스캔.

**수정:** `migrations/002_add_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_kb_domain ON semo.knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON semo.bot_sessions(last_activity DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bot_status_status ON semo.bot_status(status);
CREATE INDEX IF NOT EXISTS idx_kb_embedding ON semo.knowledge_base
  USING ivfflat(embedding vector_cosine_ops) WITH (lists = 10);
```

**파일:** `migrations/002_add_indexes.sql` (신규, P1-1 의존)

---

### P1-3: FK 제약 부재

**문제:** `bot_sessions.bot_id`에 FK가 없어 존재하지 않는 봇의 세션이 적재될 수 있다. `sessions sync` 실패 시 오류가 무시되어 카운트만 틀어진다.

**수정:**

```sql
ALTER TABLE semo.bot_sessions
  ADD CONSTRAINT fk_sessions_bot
  FOREIGN KEY (bot_id) REFERENCES semo.bot_status(bot_id) ON DELETE CASCADE;
```

**파일:** `migrations/003_add_fk.sql` (신규, P1-1 의존)

---

### P1-4: 봇 훅에 `sessions push` 미포함 — 로컬 세션 추적 불동작

**문제:** 7개 봇 훅(`handler.ts`)이 `set-status`만 호출하고 `sessions push`를 호출하지 않는다. 로컬 Claude Code 세션은 OpenClaw 게이트웨이를 거치지 않으므로 `bot_sessions`에 아무 데이터가 없다. `sessions push`는 정확히 이 용도로 설계되었다.

**수정:** 모든 7개 봇 `handler.ts`에 추가:

```typescript
// action === "new" (SessionStart)
await exec(`semo sessions push --bot-id ${BOT_ID} --event start`, { input: stdinData });

// action === "stop"
await exec(`semo sessions push --bot-id ${BOT_ID} --event stop`, { input: stdinData });
```

`sessions push`는 이미 DB 오류 시 `exit(0)`으로 조용히 실패하므로 훅 안전성 유지됨.

**파일:** `bot-workspaces/{semiclaw,workclaw,reviewclaw,planclaw,designclaw,growthclaw,infraclaw}/hooks/semo-bot-status/handler.ts` (×7)

---

### P1-5: KB 변경 이력 없음

**문제:** `context push`가 KB를 upsert할 때 이전 내용이 덮어써지며 복구 불가. P0-2 버그로 잘못된 데이터가 들어가면 롤백 수단이 없다.

**수정:**

- `semo.knowledge_base_history(id BIGSERIAL, domain, key, content, changed_by, changed_at, operation)` 테이블 추가
- `knowledge_base` BEFORE INSERT/UPDATE/DELETE 트리거로 자동 기록
- `semo kb history --domain <d> --key <k>` 조회 커맨드

**파일:** `migrations/004_kb_history.sql` (신규), `packages/cli/src/commands/context.ts` (history 조회 추가)

---

## P2 — 중기: 견고성 개선

### P2-1: `bots sync`가 `spawnSync`로 `sessions sync --all` 실행

**문제:** `bots sync` 끝에 `spawnSync`로 하위 프로세스를 생성해 세션을 동기화. 60초 블로킹, DB 연결 재생성 낭비, 오류 무시. `syncBotSessions`가 이미 외부 호출용으로 export되어 있다.

**수정:** `spawnSync` 제거 → 같은 프로세스에서 `syncBotSessions()` 직접 호출 (DB 연결 닫기 전).

**파일:** `packages/cli/src/commands/bots.ts`

---

### P2-2: IDENTITY.md 파싱 취약성

**문제:** `parseIdentityMd`의 정규식이 대소문자, 볼드 마커 변형에 민감. null 파싱 시 대시보드에 이름/이모지 없는 봇 표시.

**수정:** 정규식에 `/i` 플래그, `**Key:**`/`Key:` 양쪽 지원, 파싱 결과 100자 초과 시 잘못된 파싱으로 간주하고 skip.

**파일:** `packages/cli/src/commands/bots.ts`

---

### P2-3: KB 임베딩 순차 API 호출

**문제:** `kbPush`가 항목마다 `generateEmbedding()` 1회씩 호출. N개 항목 = N번 HTTP 요청. `generateEmbeddings()`(배치)가 이미 구현되어 있으나 미사용.

**수정:** `kbPush`에서 텍스트 수집 → `generateEmbeddings(texts)` 1회 호출 → 인덱스로 매핑.

**파일:** `packages/cli/src/kb.ts`

---

### P2-4: 메모리 Hot/Cold 분리

**문제:** SemiClaw 59개, WorkClaw 35개 메모리 파일이 세션마다 전부 로드될 가능성. 컨텍스트 윈도우 낭비.

**수정:**

- MEMORY.md에 `## Hot` / `## Cold` 섹션 컨벤션 도입
- `semo memory archive --bot <id> --before <date>` 커맨드로 오래된 파일을 Cold 섹션으로 이동
- `context sync` 시 Hot 섹션 항목만 로드하는 가이드라인 추가

**파일:** `packages/cli/src/commands/memory.ts` (신규), 7개 봇 `MEMORY.md`

---

## P3 — 장기: 아키텍처 강화

### P3-1: `context push` 경로에 임베딩 생성 추가

**문제:** 현재 `context push`(주요 결정 저장 경로)로 저장된 KB 항목에는 임베딩이 없어 `kbSearch` 벡터 검색에서 누락.

**수정:** `context push` upsert에 `generateEmbedding()` 호출 추가. 기존 항목 backfill용 `semo kb backfill-embeddings` 커맨드 추가.

**파일:** `packages/cli/src/commands/context.ts`, `packages/cli/src/kb.ts`

---

### P3-2: 온톨로지 검증 전 봇으로 확장

**문제:** `ontoValidate()`가 구현되어 있으나 InfraClaw 외에는 미사용. KB 항목이 스키마 없이 자유 형식으로 저장됨.

**수정:**

- `context push --validate` 플래그로 옵트인 검증 (초기엔 경고만)
- 30일 경고 후 `decision` 도메인부터 강제 적용
- 나머지 도메인 온톨로지 스키마를 `semo.ontology`에 적재

**파일:** `packages/cli/src/commands/context.ts`, DB 온톨로지 시딩

---

### P3-3: 컨텍스트 윈도우 사용량 측정

**문제:** 각 봇의 SEMO 인프라(메모리 파일 + KB sync 결과)가 컨텍스트 윈도우의 몇 %를 차지하는지 알 수 없음.

**수정:** `semo context stats --bot <id>` 커맨드:

- `.claude/memory/` 파일 문자 수 합산 → 토큰 추정 (chars / 4)
- 40k 토큰(200k의 20%) 초과 시 경고
- P2-4 hot/cold와 연동해 cold 이동 후보 제안

**파일:** `packages/cli/src/commands/context.ts` (subcommand 추가)

---

## P5 — 런타임 이식성 (Runtime Portable)

> 상위 목표: SEMO 를 Claude / Codex / OpenClaw / Hermes / Ollama 등 특정 모델·호스트에 종속되지 않는 시스템으로 정리. Codex 전환은 1개 adapter 로 흡수, 상위 목표 아님.
> 상세 로드맵: `docs/runtime-portable-roadmap.md`. KB decision: `semo decision personal-team-split-status-snapshot` (2026-04-27).

### P5-Pre: semo-cli 번들 컷오버 ✅ 완료

`packages/cli/package.json` `main`/`bin` 을 `dist/bundle.js` 로 전환. 5개 미배포 워크스페이스 패키지(common/kb-core/kb-pg/ops-store/discord-router) 의 12개 동적 import 를 esbuild 번들로 인라인. minify 포함 3.4 MB. 9개 영향 명령(--version, templates list, factory/exec/chat/onboard/update/router/doctor) smoke 통과. 빈 머신 npm pack 시뮬레이션 검증 완료.

배포: `cli-v4.18.13` (cutover) + `cli-v4.18.14` (minify).

### P5-0: 인터페이스 4종 + ExecutionTarget 확장 정의

**문제**: 호스트별 기능(Claude Code permission mode / Codex sandbox / Slack Block / Discord Embed)이 코드 곳곳에 분기로 흩어져 있어 새 호스트 추가 시 회귀 위험이 크다.

**수정**: 빈 인터페이스 4종을 코어 패키지에 둔다 (구현체 없이 타입만):

- `HostAdapter` — 런타임 환경 캡슐화 (Claude Code, Codex, Hermes, Ollama, ...)
- `RuntimeHarness` — 프로세스 lifecycle (start/heartbeat/cancel/shutdown/commitment 마감)
- `ToolGateway` — LLM 도구 호출 진입점 + 권한/감사
- `ProjectionEmitter` — 동일 결과를 여러 채널로 emit (Slack/Discord/Claude tool_result/콘솔)
- `ExecutionTarget` 확장 — `runtime_hint`, `tool_capabilities[]`, `projection_targets[]` 필드 추가

**파일**: `packages/common/src/runtime/` (신규)

### P5-1: ClaudeCodeAdapter 구현 (현 동작 1:1 wrap)

회귀 0 보장. 기존 cmux/Slack 통합을 인터페이스 뒤로 옮김.

### P5-2: ProjectionEmitter 도입 + Slack/Discord outbox 합류

`packages/channel-slack`, `packages/discord-router`, dashboard outbox 의 emit 로직을 단일 인터페이스로.

### P5-3: ToolGateway 도입 + 기존 hooks 단계적 이관

`~/.semo/shared/hooks/` 의 ad-hoc 처리를 코어로.

### P5-4: CodexAdapter 시범 구현 (1개 봇)

stdin/stdout 외 4 계약 명시 (Codex 리뷰 2026-04-27):

1. sandbox/approval 모델 매핑 (Codex read-only / workspace-write / dangerous ↔ ToolGateway 권한)
2. 세션 resume (Codex 세션 ID + rollout 파일을 commitment 메타에 부착)
3. tool-call bridge (Codex MCP/function-call ↔ ToolGateway 결과 포맷)
4. 파일 변경 trace (작성/수정 파일을 commitment 메타로 기록)

### P5-5: OllamaAdapter stub + Hermes stub

Personal 갈래 LLM 호스트 + 향후 데스크톱 통합 준비.

### P5-6: ExecutionTarget DB 스키마 확장

`bot_status`/`bot_delegation` 에 `runtime_hint`, `tool_capabilities`, `projection_targets` 추가. P1-1 마이그레이션 시스템 도입 후.

---

## P4 — 문서화: 패키지별 README.md 추가

### P4-1: semo CLI / semo Dashboard README.md 작성

**문제:** semo-cli와 semo-dashboard 패키지에 README가 없어, 새 AI 세션이나 다른 모델이 semo 시스템에 진입할 때 구조와 의도를 파악하지 못한다.

**수정:** 각 패키지 루트에 README.md 추가.

**semo-cli README 포함 내용:**

- 시스템 한 줄 정의 (PostgreSQL SSoT + 봇 컨텍스트 동기화)
- v3 → v4 변경 이유 (MCP 서버·biz/eng/ops 레이어 제거 배경)
- 전체 커맨드 목록 및 각 커맨드의 역할
- DB 스키마 요약 (테이블별 용도)
- 환경변수 목록 (`DATABASE_URL`, `OPENAI_API_KEY` 등)
- 봇 훅 연동 방법 (`handler.ts` 패턴)
- 개발/빌드 방법

**semo-dashboard README 포함 내용:**

- 대시보드 역할 (봇 상태 실시간 조회 UI)
- semo DB와의 연결 방식
- 주요 화면 및 데이터 흐름
- 실행 방법

**파일:**

- `packages/cli/README.md` (신규)
- `packages/semo-dashboard/README.md` (신규)

---

## 구현 순서 (의존성 기준)

```
1. ✅ P0-2  context push 도메인 가드       — 2026-03-17 완료 (83fcad4c)
2. ✅ P0-1  bots sync status 보존          — 2026-03-17 완료 (83fcad4c)
3. ✅ P2-1  spawnSync 제거                 — 2026-03-17 완료 (83fcad4c)
4. ✅ P2-2  IDENTITY.md 파서 개선          — 2026-03-17 완료 (83fcad4c)
5. ✅ P1-4  봇 훅 sessions push 추가       — 2026-03-17 완료 (83fcad4c, ×7 파일)
6. ✅ P2-3  임베딩 배치 API 호출           — 2026-03-17 완료 (83fcad4c)
7. ⬜ P1-1  마이그레이션 시스템            (1일, 이후 DB 변경의 전제)
8. ⬜ P1-2  인덱스 추가                    (2시간, P1-1 의존)
9. ⬜ P1-3  FK 추가                        (1시간, P1-1 의존)
10. ⬜ P0-3 session_count 트리거           (4시간, P1-1 의존)
11. ⬜ P1-5 KB 변경 이력                   (4시간, P1-1 의존)
12. ⬜ P2-4 메모리 hot/cold               (1일, 의존 없음)
13. ⬜ P3-1 임베딩 backfill               (2일, P1-1 의존)
14. ⬜ P3-2 온톨로지 검증 확장            (2일, 온톨로지 완성 후)
15. ⬜ P3-3 컨텍스트 통계                 (1일, P2-4 후 효과 극대화)
16. ⬜ P4-1 패키지별 README.md 작성       (2시간, 의존 없음)
17. ✅ P5-Pre semo-cli 번들 컷오버         — 2026-04-27 완료 (cli-v4.18.13 + 4.18.14 minify)
18. ✅ P5-0 인터페이스 4종                 — 2026-04-27 완료 (commit 6d870799 + 보강 61f5efcf)
19. ✅ P5-1 ClaudeCodeAdapter wrap         — 2026-04-27 완료 (commit d3308986)
20. ✅ P5-2 ProjectionEmitter 도입         — 2026-04-27 완료 (a-e: console/composite, slack/discord emitter, reply 합류, OutboxReader projection 옵션, 라우터 emitter 주입)
21. ✅ P5-3 ToolGateway 도입               — 2026-04-27 완료 (a-c: InMemoryToolGateway, ask_user/react wrap)
22. ✅ P5-4 CodexCliAdapter 시범           — 2026-04-27 완료 (capability/probe/lifecycle + trackFileChanges + bridge helpers)
23. ✅ P5-5 OllamaAdapter + Hermes stub    — 2026-04-27 완료 (commit 069bd8e4)
24. ⬜ P5-4b.iii Codex MCP server entry    (보류 — MCP SDK 의존성 트레이드오프 결정 필요)
25. ⬜ P5-6 ExecutionTarget DB 스키마 확장 (1일, P5-1 + P1-1 의존)
```

P5 시리즈는 P0~P4 와 독립적으로 병렬 진행 가능 (P5-6 만 P1-1 의존).

### 추가 작업 (플랜 외)

- ✅ `sessions.ts` 소스 파일 복원 (dist에만 존재하던 것 → src 복원)
- ✅ `index.ts`에 `registerSessionsCommands` import 및 호출 추가

---

## 검증 방법

- **P0-2**: `semo context push --domain team` → "decision 도메인만 지원" 오류 확인
- **P0-1**: 봇 훅으로 `online` 설정 후 `semo bots sync` 실행 → `status` 유지 확인
- **P1-4**: 로컬 세션 시작 후 `semo bots sessions` → 세션 row 생성 확인
- **P1-2**: `EXPLAIN ANALYZE SELECT ... WHERE domain = 'decision'` → Seq Scan → Index Scan 변화 확인
- **P2-1**: `semo bots sync`가 60초 블로킹 없이 완료되는지 확인
- **P2-3**: 50개 KB 항목 push 시 OpenAI API 호출 횟수 1회로 감소 확인
- **P4-1**: `packages/cli/README.md`, `packages/semo-dashboard/README.md` 존재 및 내용 완전성 확인
