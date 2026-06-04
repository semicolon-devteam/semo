# 동적 에이전트 실행 런타임 재설계 (옵션 A — serve-worker on-demand)

> 작성: 2026-06-03 · 트리거: "추후 동적으로 에이전트가 생성·위임·실행되도록 구조 자체를 재설계."
> 워크플로우 매핑(5 에이전트) 근거. 사용자 결정 반영. **Codex 검토 반영 완료. Phase 0부터 구축.**

## Context / 문제

현 위임→실행이 **cmux-pane + mailbox nudge + 정적 봇목록 + OpenClaw socket**에 결합돼 동적이 불가:

- **transport 불일치 (핵심)**: OpenClaw 7봇은 자체 socket-mode로 수신. Semi 오케스트레이터는 `dispatchToInbox`(index.ts:1357)로 mailbox에 씀 → OpenClaw 봇은 mailbox를 안 읽음 → **orphan, 영원히 미처리**(reviewclaw 멈춘 진짜 원인).
- **콜드스타트 계층 부재**: 봇 깨우는 모든 경로(nudge inbox-writer.ts:153, pump, fs.watch)가 `surface-map`(botId→cmux surface, surface-map.ts:13) 또는 살아있는 세션 전제. surface-map 생성 스크립트(semo-agents-start.sh:204)는 2026-05-07 이후 미실행 → `/tmp/semo-surface-map.json` 부재 → **모든 nudge "no surface mapping" skip**.
- **정적 6곳 하드코딩** + roster hot-reload 부재(loadOpenClawBots 부팅 1회, index.ts:523) → 동적 봇이 코드+재기동 요구.
- **정의→Hermes 렌더러 부재** → 임의 DB 정의를 on-demand 실행 불가(정적 프로비저닝 선행).

## 핵심 자산 (재사용)

- **`runtime.ts serve`(L430-690)** — 이미 있는 **cmux-free 범용 워커 후보**. 의도한 흐름은 DB runtime config 조회 → `buildAdapterFromHostKind`(L152-209, claude-code/codex/openclaw/ollama/hermes-cli/hermes-desktop) → inbox.jsonl 폴링(순차) → adapter.dispatch → outbox.jsonl + 실패 placeholder. **surface-map 의존 0, 봇이름 하드코딩 0.** 단, 현재 repo 기준 `bot_status.config` SoT drift와 idle 종료 부재가 있어 Phase 0에서 먼저 보정한다.
- **hermes-cli-adapter** — Semi/Colony/Operator 프로덕션 구동 중 + **seatless**(Claude seat 풀 무관 → 동적 다수 에이전트 유일 경로).
- agent_personas(행동 SoT), semi-roster(데이터 roster), HostAdapter 추상화, bot_commitments(작업 추적), handleReplyPosted(완료 마감, index.ts:360).

## 목표 아키텍처

**모든 에이전트 실행을 serve-worker(mailbox→spawn→adapter→outbox) 단일 경로로 통합**하고 cmux/surface-map/socket-orchestrator-mismatch 제거.

```
Semi ROUTE / 직접 라우팅 → inbox.jsonl(에이전트별 큐) + bot_commitment(active)
   → [mailbox-supervisor: 미처리 큐 있고 워커 없으면 spawn]
   → serve-worker(child_process): 큐를 순차 drain (작업1→outbox→commitment done→작업2 …)
      → host_kind=hermes-cli 면 wrapPrompt에 DB persona 동봉(clone 불필요)
   → 큐 비면 워커 종료(ephemeral 경계; `--once` 반복 또는 `--idle-exit-ms` 추가). 대시보드는 에이전트별 active commitment 큐 표시.
```

### 사용자 결정 반영

- **실행 모델 = 에이전트별 순차 큐**: 워커는 그 봇의 큐(inbox/active commitments)를 **한 번에 하나씩** 처리, 완료 후 다음. 큐 비면 종료. 동시성=봇당 1은 migration 089가 아니라 별도 worker claim lock/registry로 보장. **대시보드에서 에이전트별 큐 가시화**(active commitments ordered by created_at).
- **정의 전달 = runtime prompt envelope**: wrapPrompt에 `agent_personas` + `agent_definitions` + capability/allowed-tools + KB rules를 동봉. profile clone 불필요 → 임의 DB 정의 즉시 실행. persona version/hash는 audit에 기록.
- **supervisor = slack-router child_process spawn**(cmux ancestry 불필요, daemon 금지 제약서 자유).
- **범위 = Phase 0~5(내부)**. 고객 실행 브릿지(Phase 6)는 별도.

## 마이그레이션 (Codex 검토 반영 — 재정렬. 라이브 무중단, 각 단계 독립 PR·롤백)

### Phase 0 — 기반 정합 (Codex 추가, 빌드 전 필수)

- **config SoT 정합 (Codex #5)**: `runtime.ts serve`의 `loadBotRecord`는 `bot_status.config`를 읽는데(runtime.ts:142), repo 마이그레이션에 `config` 컬럼이 없고 `createBot`은 runtime config를 `projection_targets.runtime`에 넣음(bots-factory.ts:335). → serve가 빈 값을 읽는 버그. **먼저 SoT 컬럼/쿼리 일원화**(config 컬럼 추가 마이그레이션 또는 serve가 projection_targets.runtime 읽도록).
- **worker claim lock 설계 (Codex #4)**: migration 089는 `(bot_id, slack_event_id)` 중복방지일 뿐 **봇당 active 1 보장 아님**. 사용자 요구(에이전트별 순차 큐)엔 별도 claim lock 필요 → PG advisory lock(`pg_try_advisory_lock(hashtext(bot_id))`) 또는 `bot_runtime_workers`(bot_id, pid, heartbeat) registry. 봇당 워커 1 보장.
- **outbox dynamic watch 설계**: OutboxReader 봇목록(index.ts:492 정적) → DB bot_status 동적.

### Phase 1 — runtime prompt envelope

- **runtime prompt envelope (Codex #7)**: `hermes-cli-adapter.wrapPrompt` 단순 가이드 대신 `agent_personas.soul_md`, `agent_definitions.persona_prompt`, capability/allowed-tools, KB rules를 하나의 envelope로 조립해 dispatch. `--ignore-rules`·one-shot으로 약해지는 layered behavior를 보완한다.
- audit에 `persona_slug`, `persona_version`, `persona_hash`, `agent_definition_hash`, `runtime_config_hash` 기록. 장애/회귀 시 어떤 정의로 실행됐는지 재현 가능해야 한다.
- profile clone은 fallback/bootstrap 용도로만 유지하고, 동적 실행 path는 envelope를 우선한다.

### Phase 2 — reviewclaw 단일 canary (Codex #2: 단일봇 증명 우선)

- **Semi→mailbox→serve-worker→outbox 경로만** reviewclaw 하나로 복구. OpenClaw socket 직접멘션은 유지(병존).
- `bot_status.config`(또는 SoT)에 reviewclaw `host_kind` 지정 + serve 1회 수동 기동으로 inbox drain → outbox → `handleReplyPosted`(index.ts:360) commitment done 확인.
- **중복수신 방지 (Codex #3)**: reviewclaw transport_owner='serve' 플래그 + source_ref/slack_event_id dedupe. (이 단계선 socket도 살아있으므로 dedupe 필수.)
- 검증: @Semi→ROUTE reviewclaw → serve-worker 처리 → Slack 응답 + commitment done. (현재 orphan이던 케이스 복구.)

### Phase 3 — mailbox-supervisor on-demand spawn (콜드스타트, **핵심**)

- 신규 supervisor(slack-router child_process): inbox 미처리 + 워커 부재 시 `semo runtime serve --bot {id} --once` 반복 또는 `--idle-exit-ms`가 추가된 serve-worker spawn → 큐 순차 drain → idle 종료.
- **하드닝 (Codex #6)**: `detached:false` + parent exit 시 SIGTERM 전파, pid liveness/heartbeat timeout kill, spawn backoff, max workers, orphan cleanup. **"실패=consumed" 정책 재검토**(runtime.ts:640 placeholder) → 실패 작업이 큐에서 조용히 사라지지 않게 retry/DLQ.
- `inbox-writer.nudgeBot`(inbox-writer.ts:153): surface-map → supervisor 통지로 교체. surface-map/semo-agents-start.sh 폐기.
- 검증: surface-map 삭제 상태에서 휴면/동적 봇 dispatch → 자동 spawn → outbox → done.

### Phase 4 — 7봇 봇별 mailbox-worker 전환 (위험 구간, 봇별 점진)

- 봇별로 reviewclaw→나머지: `runtime_source=serve-worker` 플래그 켜고 안정화 → **그 봇의 OpenClaw Slack app event를 마지막에 disable**(중복수신 종료). transport_owner 플래그로 소유권 명시.
- `dispatchToInbox` policy 가드는 이 시점(serve-worker가 그 봇을 소비) 활성.
- 검증: 봇별 전환 후 직접멘션·ROUTE 둘 다 단일 처리(중복 없음), 롤백(env 토글) 동작.

### Phase 5 — 정적 잔재 제거 + 동적 roster/대시보드 큐

- 정적 봇목록(OutboxReader index.ts:492, FALLBACK_BOT_IDS bot-config.ts:143, agent-mailbox escalate, codex-fallback PERSONA_PROMPTS) → DB bot_status 동적. `createBot`→KB `bot-ids` runtime_source upsert + `loadOpenClawBots` hot-reload(재기동 없이 roster 인지). semo-agents-start.sh deprecate.
- **대시보드(app/bots)**: 에이전트별 active commitment **큐**(ordered) + 진행 상태(사용자 요구).

### (범위 밖) Phase 6 — 고객 실행 브릿지

migration 008 승격, SEMO_RUNTIME_URL→serve 워커풀, agent_installs dispatchable 해제.

## 핵심 리스크 (Codex 반영)

- **봇당 1 워커 보장**: 089로 불충분 → advisory lock/registry 필수(아니면 동일 봇 동시 워커 → 중복/경쟁). Phase 0에서 선해결.
- **config SoT 불일치**: 선해결 안 하면 serve가 빈 config 읽어 Phase 1부터 깨짐.
- **중복수신**: socket+mailbox 병존 구간 dedupe + transport_owner + 직접멘션 disable 순서.
- **supervisor SPOF/좀비**: 하드닝 명세 필수. 실패-consumed 정책 재검토. parent/slack-router 재시작 후 이전 child 정리와 worker registry reconciliation 필요.
- hermes one-shot 무기억: prompt envelope 재동봉 또는 sessionResume.

## Codex 검토 결과

- **판정**: 방향(serve-worker 통합 + supervisor + wrapPrompt + 봇별 점진) 승인. 진단(transport 불일치=reviewclaw orphan) 정확.
- 반영: Phase 0 신설(config SoT·worker lock·outbox dynamic), Phase 1=runtime prompt envelope, Phase 2=reviewclaw 단일 canary, 089 오해 정정→claim lock, 중복수신 dedupe+transport_owner, supervisor 하드닝+실패정책. 단계 재정렬.
- Codex KB: not-needed(리뷰만).

## 구현 현황 (2026-06-04 업데이트)

**완료·커밋 (branch `feat/rebrand-semicolony-phase0`, 그 전엔 `feat/semi-colony-improvements`):**

- **Phase 0 엔진**:
  - worker advisory lock (`pg_try_advisory_lock(hashtext('semo-serve:'+bot))`) — 봇당 1 워커 보장.
  - `bot_status.config` 직접 조회 SoT (testbot-dyn 으로 검증 — config 만으로 동적 에이전트 구동).
  - **동적 persona envelope**(`loadPersonaEnvelope`: agent_personas.soul_md → agent_definitions.persona_prompt) → serve 가 프롬프트에 prepend (adapter-agnostic). `f704c07b`.
  - **`--idle-exit-ms`** ephemeral 워커(큐 비면 종료). `96a757f1`.
  - **`--max-message-age-ms`** stale 가드(오래된 orphan 메시지는 dispatch 없이 consume). `34ee71e9`.
- **Phase 2 supervisor**: mailbox-supervisor (on-demand spawn + backoff + maxWorkers + SIGTERM 전파 + idle-exit/stale-guard args 주입). 테스트 6/6. `38ecc621` + 후속.
- **ollama-cli 호스트 어댑터**(무인증 테스트 호스트, spawn+stdin). `f704c07b`.

**E2E 증명**:

- 동적 생성→실행: DB-only 에이전트(testbot-dyn) → serve → persona envelope → ollama → outbox(서명 일치). `processed=1`.
- **Phase 1 reviewclaw 카나리**(2026-06-04): `inbox → serve-worker → OpenClawAdapter → gpt-5.5 → outbox → (기존 OutboxReader) → Slack` 전체 루프 동작. 라이브 OpenClaw 게이트웨이 무손상, auth 무영향. 카나리 메시지 정확 응답.
- **발견**: serve-worker 가 묵은 orphan 백로그를 드레인하면 stale 응답이 실채널로 게시됨 → `--max-message-age-ms` 가드 신설(검증: 2일전 메시지 consume=1/dispatch=0). reviewclaw 백로그(11건) 전체 freeze.

**남은 활성화 (의도적·관측 하 수행 필요)**:

- 라이브 slack-router 가 supervisor 커밋(22:49) **이전(17:47) 기동** → 현재 `serve_worker_enabled` **inert**. Phase 1 auto-spawn 활성화 = **라이브 router 재기동(신코드)** 필요 — 전체 Slack 환경(Semi/Colony/operator) 영향 + Codex rebrand 세션과 동일 코드 경합 → 조율 후 단일 관측 단계로.
- 활성화 절차: `serve_worker_enabled=true`(reviewclaw) + cmux pane 안에서 router 재기동(router-operations.md 준수) + 실 `@Semi→ROUTE:reviewclaw` 1건으로 auto-spawn→outbox→Slack 확인.

## 결정 기록

KB `semo decision/dynamic-agent-runtime-redesign-2026-06-03` (예정).
