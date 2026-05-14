# Delegation 시스템 후속 개선 로드맵

> Codex review id `abe3857bea0cd46a0` (2026-05-14) 의 Q2 A-E 항목을 실행 plan 으로 구체화.
> 본 plan 은 `semo decision/delegation-enforcement-2-layer-2026-05-14` (Layer A+B+C) 의 후속.

## Status (2026-05-14 15:17 KST)

| Layer | 적용 |
|---|---|
| A — Hook (`semo guard run delegation-check`, UserPromptSubmit) | ✅ 8봇 적용 |
| B — Prompt (CLAUDE.md "Delegation Rules" 섹션) | ✅ 8봇 적용 |
| C — OpenClaw `before_dispatch` plugin | ✅ 7봇 실 로드 검증 완료 (`loaded 6 internal hook handlers`, +1 = delegation-guard) |

Codex Q1 발견: OpenClaw plugin discovery SoT 는 `HOOK.md` (frontmatter 명세). `metadata.json` 은 무시. 본 plan 의 1번 항목은 즉시 fix 됨 (HOOK.md 7봇 배포 + renderer 수정).

---

## A. agent-factory sync 자동 배포 path 완성

### 현 상태
- `agent-factory.ts:1046-1073` 에 sync 명령 골격 존재 (dirty, 미커밋)
- `renderers.ts:338-404` OpenClawAgentRenderer 가 artifact emit
- 그러나 **`semo agent-factory sync --targets openclaw` CLI 명령 미노출** (현재 create/delete/show 만)
- 우리 수동 배포 = `tsx /tmp/deploy-openclaw-delegation-guard.ts` ad-hoc script

### 필요 작업
1. `agent-factory.ts:1046-1073` sync 로직 commit (transition 작업자 commit 또는 우리 자체 정리)
2. renderer artifact 가 `HOOK.md` emit (✅ 본 turn 완료, commit 대기)
3. `agent-factory.ts:495-569` `openclaw-apply` deep-merge 로 `openclaw.json` 의 `hooks.internal.entries.delegation-guard` + `hooks.internal.load.extraDirs` 패치 (backup 보존 + idempotent)
4. CLI 명령 노출: `semo agent-factory sync --targets openclaw --ids semiclaw,planclaw,...`

### 검증
`semo agent-factory sync --targets openclaw --ids semiclaw` 실행 후 `~/.openclaw-semiclaw/` 의 HOOK.md/handler.js + openclaw.json hooks 변경 확인.

---

## B. Plugin 로드 wiring 신호 (silent skip 방지)

### 문제
이번 turn 에서 발견한 silent skip — `Registered hook` 라인은 `log.debug` (default 미노출), error 라인도 없어서 plugin 미로드를 즉시 알 수 없음. config reload 로그 (`[reload] config hot reload applied (hooks.internal.entries.delegation-guard)`) 는 보였지만 그건 config 인식만, handler 로드 검증 X.

### 필요 작업
1. **OpenClaw renderer 가 `openclaw-hook-status.json` 도 emit** — 기대되는 hook 명단 (이름, events, version) 명시
2. **`semo agent-factory doctor` 명령 또는 `--probe` 옵션** — 봇 재기동 후 gateway.log 의 `loaded N internal hook handlers` 카운트 + `openclaw-hook-status.json` 의 expected 비교
3. CI 또는 cron 으로 주기 검증 — drift 발생 시 알람

### Defense-in-depth
설사 OpenClaw 가 `Registered hook` 를 INFO 로 올리더라도 (vendor 변경), 위 probe 가 봇 행동 신뢰의 SoT.

---

## C. delegation-cache.json 자동 invalidation

### 현 상태
`~/.semo/state/delegation-cache.json` 의 TTL 1h. KB 변경 (`semo kb upsert {bot} delegation`) 시 즉시 반영 안 됨.

### 필요 작업
1. KB schema 의 `NOTIFY semo_kb_change` 활용 — `migrations/105_kb_notify.sql:1-44` 에 이미 있음 (Codex 확인)
2. slack-router 또는 별도 daemon 이 `LISTEN semo_kb_change` 후 `bot_delegation` / `knowledge_base.delegation` 변경 감지 시 `~/.semo/state/delegation-cache.json` 삭제 또는 mtime backdate
3. 다음 `semo guard run delegation-check` 호출 시 fresh fetch 트리거
4. TTL fallback 은 유지 (DB notify 실패 대비)

### 추가 옵션
KB upsert CLI 가 `semo guard cache-bust` (또는 동등 명령) 자동 호출. 즉시 cache invalidate.

---

## D. 'stuck' PaneState OS-level recovery

### 현 상태
`health-monitor.ts:285-299` 에 'stuck' 인식만 있음 (`console.error` 로그). 자동 recovery 없음. 이번 SemoBot quota incident 에서 수동 `/exit` + 새 세션 시작.

### 필요 작업 (Codex 명시 — `health-monitor.ts` 확장)
1. `stuckSince: Map<string, number>` — 봇별 'stuck' 진입 시점 추적
2. `SEMO_HEALTH_STUCK_KILL_AFTER_MS` env (default 5min)
3. 'stuck' 지속 시 `acquireRestartLock(botId)` → cmux pane 의 Claude process pid 추적 → SIGTERM → `startCmd` 로 새 세션
4. 기존 cooldown/allowlist 체크 유지 — fail-safe

### Pid 추적
- cmux pane 안의 Claude process pid 는 `cmux read-screen` 만으로는 못 얻음
- 가능 path: `pgrep -P <cmux pane process pid> claude` 또는 launchctl 의 자식 pid 트래킹
- OR `cmux send` 로 `pkill -SIGTERM -f "claude"` 같은 명령 보내기 (modal 차단 시 동작 안 함 — vector 못 됨)
- 가장 robust: 봇 cmux pane 자체 close + new-split 으로 새 pane + surface map 갱신

### Risk
process kill 자체가 안 되면 OS-level signal 송신만으로 봇 재기동 — 실증 후 결정.

---

## E. SemoBot quota_exhausted flag

### 현 상태
SemoBot 자연어는 `~/.semo/mailbox/semobot/inbox.jsonl` → cmux pane Claude Max → outbox.jsonl. quota 한도 시 limited mode 또는 silent fail. 자동 fallback 없음.

### 필요 작업 (Codex 추천)
1. `bot_status.runtime_state JSONB` 컬럼 추가 (또는 `quota_exhausted_at TIMESTAMPTZ` nullable) — surface map 부적합 (transport placement)
2. **Detection**: SemoBot outbox 의 "제한 응답 모드" 메시지 또는 LLM call 실패 회수 카운터 → 임계 도달 시 flag set + KB log
3. **Routing override** (slack-router): `quota_exhausted=true` 봇 의 자연어 메시지 수신 시 → SemiClaw mailbox 로 자동 forward + `route_reason=semobot-quota-fallback`
4. **Chain escalation 통제** (Codex 명시): SemiClaw 가 fallback 받으면 `max-hop=1` — terminate 또는 direct reply, 재 escalate 금지
5. **Reset**: quota window (5h) 후 flag clear (cron 또는 health-monitor)

### KB 결정 필요
- Slack UX: SemoBot 명의 → SemiClaw 명의 응답 표시. 사용자 혼란 가능 → `[SemoBot quota fallback via SemiClaw]` prefix 추가
- 영구 결정 (B 옵션 always-escalate) vs 임시 fallback (A 옵션) — A 우선

---

## 진행 우선순위 (의존성 기반)

| 순서 | 항목 | 의존 |
|---|---|---|
| 1 | **A 의 sync 명령 commit + renderer HOOK.md emit** (본 turn 일부 완료) | — |
| 2 | **B probe 명령** | A 완료 후 (CLI 명령 의존) |
| 3 | **C cache invalidation** | 독립 (migrations/105 이미 있음) |
| 4 | **D OS-level recovery** | 독립 (health-monitor.ts) |
| 5 | **E quota_exhausted flag** | 독립 (bot_status 스키마 변경 필요) |

## 본 turn 산출물

- `~/.openclaw-{bot}/plugins/delegation-guard/HOOK.md` × 7 (즉시 fix, plugin 정상 로드 검증됨)
- `packages/common/src/agents/renderers.ts`: `OpenClawAgentRenderer.render()` 가 HOOK.md emit + `openclawDelegationGuardHookMd()` 함수 신규
- `packages/common/src/__tests__/agent-spec-renderers.test.ts`: artifact 목록에 HOOK.md path 추가
- 본 plan 문서 (`docs/superpowers/plans/2026-05-14-delegation-improvement-roadmap.md`)

다음 commit + KB decision 기록 후 종료. 5개 항목은 별 세션.
