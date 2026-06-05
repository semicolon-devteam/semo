# DB-Driven 봇 아키텍처 설계 (로컬 파일 최소화 · DB 단일 SoT)

> 작성: 2026-06-04 · 트리거: "설치 후 로컬 파일 수정이 거의 필요 없게, 닉네임뿐 아니라 모든 것(페르소나·행동·스킬·라우팅·식별)을 DB 기반으로. 사후 유지보수 쉽게."
> 근거: db-driven-bot-architecture-plan Workflow(호스트 적합성·모델선택·파일분류 분석) + 이번 세션 customer-runtime(순수 DB 모델 증거) + reviewclaw Stage B(마이그레이션 패턴).
> 상태: **설계안 — 승인 후 구현.**

## 문제

내부 7봇(semiclaw/planclaw/designclaw/workclaw/reviewclaw/infraclaw/growthclaw)은 OpenClaw 로컬 프로필에 의존: **봇당 1K~14K 파일, 85M~1.3G**. 봇 정체성/페르소나/설정이 `openclaw.json`(+8개 .bak), 렌더된 `agent-spec`, `~/.claude/agents/{bot}.md`(SOUL), KB, DB(bot_status/agent_definitions)에 **중복·분산** → 닉네임 하나 바꾸려 해도 어디를 고쳐야 할지 불명확하고 드리프트 발생. 반면 이번 세션의 **customer 에이전트는 로컬 프로필 0**(DB → serve-worker → envelope)으로 동작 = 목표 모델의 살아있는 증거.

## 핵심 원칙

**편집 가능한 모든 것의 단일 SoT = DB.** 로컬 파일은 두 종류만 허용:

1. **재생성 가능한 캐시** — DB에서 렌더. 수기 편집 금지. 언제든 삭제 후 재생성 가능.
2. **irreducible 로컬** — 보안(시크릿)·성능(런타임 큐)·민감(메모리)상 로컬 불가피한 최소집합.

→ "닉네임/페르소나/행동/스킬/라우팅/식별" 변경 = **DB 한 곳 수정 + 재렌더**. 로컬 수기 편집·전파 불필요.

## 로컬 파일 운명표 (분석 결과)

| 현재 로컬                                                                           | 분류            | 운명                                                                                    |
| ----------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `~/.claude/agents/{bot}.md`(SOUL)                                                   | SoT-in-file     | **→ DB** (agent_definitions.persona_prompt / agent_personas.soul_md). 파일은 렌더캐시化 |
| `openclaw.json` config(ui/model/channels/routing)                                   | SoT-in-file     | **→ DB** (bot_status.config). 파일은 DB에서 렌더                                        |
| `agent-spec.{meta,patch}.json`                                                      | SoT(버전드)     | **→ DB** + 렌더. `*-last-rendered.json` 즉시 제거(온디맨드 계산)                        |
| `cron/jobs.json`                                                                    | SoT-in-file     | **→ DB** (이미 bot_cron_jobs SoT 존재 — 파일 동기화 제거됨, v4.17)                      |
| `identity/device.json`, `auth-profiles.json`(OAuth)                                 | **시크릿**      | **로컬 유지**(irreducible). DB-암호화 후 런타임 materialize는 장기옵션                  |
| `~/.semo/mailbox/{bot}/*.jsonl`                                                     | 트랜잭션 큐     | **로컬 유지**(런타임). fs.watch 효율 — DB이전은 트레이드오프, 보류                      |
| `memory/main.sqlite`(6.2MB)                                                         | 에이전트 메모리 | **로컬 유지** 또는 암호화 후 이전(장기)                                                 |
| `.bak*`, `completions/*`, `logs/*`, `media/*`, `.openclaw/` 미러, `*-last-rendered` | 캐시/아티팩트   | **제거/아카이브**(재생성·S3). 즉시 정리 가능                                            |

**효과**: 봇당 200M → ~6MB(메모리 제외 시 ~수십KB), **97% 파일 감축**. SoT는 전부 DB.

## 권장 모델: 하이브리드 (순수 DB 수렴)

분석 결론 반영:

- **신규 + 고객 에이전트 = 순수 DB-driven(A)** — serve-worker + envelope, 로컬 프로필 0. **이미 구현·검증 완료**(customer-runtime).
- **기존 7 OpenClaw 봇 = DB-SoT + 렌더캐시(B) → 점진적 A 수렴**:
  - 1단계(B): 정체성/페르소나/config를 **DB를 SoT로** 확정 → OpenClaw 프로필을 **DB에서 렌더한 disposable 캐시**로 강등(수기편집 금지). 드리프트 제거 + OpenClaw 기능(browser/canvas/MCP/cron) 보존.
  - 2단계(A 수렴): 봇별로 serve-worker(DB envelope) 경로로 전환(reviewclaw Stage B 패턴). serve-worker가 필요한 도구를 흡수하는 만큼 OpenClaw 프로필 의존 제거.

**왜 즉시 전면 A가 아닌가**: 호스트 분석상 **순수 DB-only 호스트는 ollama(도구 없음)뿐**. OpenClaw의 browser/canvas/MCP/cron/workspace를 serve-worker가 아직 다 대체 못 함. 전면 A는 기능 상실. 그래서 B로 SoT를 먼저 DB로 옮겨 **유지보수 목표(단일 편집점)를 즉시 달성**하고, 기능 보존하며 A로 수렴.

> 핵심: 사용자 목표("로컬 수정 최소화/DB기반")의 본질은 **디스크 용량이 아니라 "편집점 단일화·드리프트 제거"**. 모델 B만으로도 그 목표는 100% 달성(모든 SoT=DB, 로컬=재생성 캐시). 용량(workspace/memory)은 별개 아카이빙 이슈.

## 목표 아키텍처

```
[DB 단일 SoT]                          [런타임]                    [로컬 — 최소]
bot_status(config: host_kind,          serve-worker / OpenClaw     · 시크릿(auth/device)
  identity, nickname, channels,   →    가 DB에서 envelope/프로필  · mailbox 큐(jsonl)
  routing, model, skills)              빌드 → dispatch             · memory.sqlite
agent_definitions(persona_prompt)                                  · (렌더캐시: 재생성가능)
agent_personas(soul_md, override)
bot_cron_jobs / KB bot-config
```

## 핵심 산출물 (구현 시)

1. **DB 스키마 정합** — openclaw.json config 필드 + identity(nickname/emoji/channels/routing)를 bot_status.config로 일원화. 빠진 컬럼 보강.
2. **`semo bots render {bot|--all}`** — DB → 로컬 OpenClaw 프로필(openclaw.json/agent-spec/agent .md/SOUL) 멱등 렌더. 로컬=disposable. (수기편집 대체.)
3. **`semo bots set {bot} --name|--persona|--config ...`** — DB 수정 진입점. 변경 시 자동 재렌더 트리거. **rename/edit = 이 명령 하나.**
4. **`semo bots rename`** — 표시명(닉네임)=DB 필드 수정만(bot_id 유지, cosmetic). bot_id 자체 변경은 별도 위험작업으로 분리.
5. **로컬 정리기** — `.bak/completions/logs/media/.openclaw 미러/*-last-rendered` 제거·아카이브(97% 감축).
6. **serve-worker 수렴(점진)** — 봇별 DB envelope 실행 전환(reviewclaw 패턴), OpenClaw 기능 의존 줄어드는 대로.

## rename/edit 시나리오 (이 설계에서)

| 작업          | DB 작업                                            | 로컬                                        |
| ------------- | -------------------------------------------------- | ------------------------------------------- |
| 닉네임 변경   | `bots set {bot} --name X` → bot_status.name        | 자동 재렌더(또는 불필요 — 런타임이 DB 읽음) |
| 페르소나 수정 | `bots set {bot} --persona ...` → agent_definitions | 재렌더, 수기편집 X                          |
| 봇 추가       | DB insert(bot_status+persona) → render             | 프로필 생성됨(렌더), 또는 serve-worker는 0  |
| 봇 삭제       | DB delete → 로컬 정리                              | 디렉토리 제거                               |

→ **모든 편집이 DB 한 곳.** 로컬 전파/드리프트 없음.

## 마이그레이션 로드맵 (라이브 무중단, 봇별 점진)

- **P0 정리**: 재생성 캐시(.bak/completions/logs/media/미러) 정리 — 무위험, 즉시 97% 감축.
- **P1 SoT 확정**: 각 봇 openclaw.json config + identity를 DB(bot_status.config)로 추출·일원화. `bots render`로 역방향 검증(DB→파일이 현재와 동일).
- **P2 렌더캐시화**: 로컬 프로필을 "DB에서 렌더된 disposable"로 선언. 수기편집 금지(가드). 변경은 `bots set`.
- **P3 serve-worker 수렴**: 봇별(reviewclaw부터) DB envelope 실행 canary → 안정화 → OpenClaw 프로필 의존 축소.
- 각 단계 봇별 PR + 플래그 롤백.

## irreducible 로컬 (최종 잔존)

- **시크릿**: `identity/device.json`, `auth-profiles.json`(OAuth) — 로컬 유지(평문 DB 부적합). 장기: DB-암호화 + 런타임 materialize.
- **런타임 큐**: mailbox jsonl — 로컬 유지(fs.watch 효율). 장기: DB 테이블 옵션.
- **메모리**: `memory/main.sqlite` — 로컬 유지/암호화.
- **임시**: locks/sessions/logs — 재생성.

## 사용자 결정 필요 (구현 전)

1. **모델 확정**: 하이브리드(신규=A, 기존=B→A) 권장 — OK?
2. **OpenClaw 유지 vs serve-worker 전면 전환**: 기능(browser/canvas/MCP) 보존 위해 B(렌더캐시) 우선 권장. 전면 A(기능 일부 포기)도 가능 — 선호?
3. **mailbox/memory DB 이전**: 지금은 로컬 유지 권장(런타임/성능). 나중 이전 — OK?
4. **마이그레이션 첫 봇 + 속도**: reviewclaw(이미 부분 전환)부터 권장.

## 범위 밖

- workspace/media 용량 아카이빙(별개 이슈).
- 시크릿 DB-암호화(장기).

---

## 구현 현황 (2026-06-04, feat/rebrand-semicolony-phase0)

| 단계                | 상태              | 산출물                                                                                                                                   |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **P0 정리**         | ✅ 완료·적용      | `semo bots clean-cache [--bot                                                                                                            | --all] [--apply]`. 7봇 77건 2.7M 삭제. 보호: identity/auth/credential/secret/memory/device/.openclaw 미러/mailbox/cron. .bak 은 last-good+최신1 보존. |
| **P1 SoT 확정**     | ✅ 완료(식별자)   | bot_status(name/emoji) = 식별자 SoT 확인. config(channels/hooks/model)는 이미 agent-spec.patch 로 DB-렌더 or 시크릿(로컬).               |
| **P2 render/set**   | ✅ 완료           | `semo bots render`(DB→openclaw.json ui.assistant 머지, secrets 보존, dry-run 기본, 드리프트 무단변경 방지) + `semo bots set <bot> --name | --emoji`(단일 편집점, **4 surface 동시 전파**: name/slack_username DB + ui.assistant/meta.displayName 로컬).                                          |
| **P3 serve-worker** | 🟡 canary durable | `semo bots worker <bot> --start                                                                                                          | --stop                                                                                                                                                | --status`(/tmp 휘발성 → 공식 관리형 일반화). reviewclaw 관리형 마이그레이션 완료. **cutover 미실행(아래 런북, 승인 필요).** |

식별자 변경 = `semo bots set` 한 곳. render --all 드리프트 0(infraclaw 🏗️ 확정).

## P3 cutover 런북 (outward-facing — 봇별 명시 승인 후)

현재 7봇은 **자체 OpenClaw socket-mode 로 Slack 직수신**. serve-worker canary 는 격리된
mailbox 만 폴링(실 트래픽 0, 이중처리 없음 — 안전). 실 전환은 아래 순서로 봇별 진행:

1. **전제 검증**: 대상 봇 워크로드가 OpenClaw 전용기능(browser/canvas/MCP/cron) 불필요한지 확인.
   필요하면 serve-worker 가 해당 도구 흡수할 때까지 cutover 보류(설계 §42).
2. **라우팅 배선(플래그 OFF)**: slack-router 가 대상 봇 멘션을 `~/.semo/mailbox/{bot}/inbox.jsonl`
   에 기록하도록(고객위임 `delegateCustomerRequest` 패턴 재사용) — `INTERNAL_SERVE_WORKER_BOTS`
   env 게이트, 기본 OFF(동작 불변).
3. **canary 관찰**: 플래그 ON → serve-worker 가 실 메시지 dispatch → outbox → slack-router 포스트.
   OpenClaw socket-mode 와 **동시 수신 중복** 방지를 위해 이 시점에 socket-mode 의 해당 채널 구독을
   먼저 끊거나(권장) 멱등 가드 필요. 소수 채널로 canary.
4. **socket-mode 은퇴**: 회귀 없음 확인 후 대상 봇 OpenClaw LaunchAgent 정지 + `semo bots worker
{bot} --start` 로 serve-worker 만 운용. 롤백 = LaunchAgent 재기동 + 플래그 OFF.
5. 봇별 독립 진행. 첫 대상 reviewclaw(PR 라벨 트리거 — 상시 socket-mode 의존 낮음) 권장.

**위험 게이트**: 3·4 단계는 Slack 표면(사용자 노출)을 바꾸므로 **봇별 명시 승인** 후에만 실행.
1·2 단계(플래그 OFF 배선)는 동작 불변이라 선행 가능.
