# SEMO 통합 제품 아키텍처 — Dashboard ↔ Runtime ↔ Agents ↔ Storage ↔ Channels (2026-05-29)

> 목표: SEMO Dashboard를 "디자인 반영"에서 "실사용 가능한 통합 제품"으로. 기존 아키텍처와
> 충돌 없이(additive), 고객 설치형(semo cli), 멀티 스토리지(pluggable), 채널 정책 일관.
> SoT 충돌 시 `docs/plans/2026-05-28-customer-dashboard-handoff.md` 우선.

## 0. 제품 원칙 (NON-NEGOTIABLE)

- **One Product, Multi Persona**: 공통 IA(Home/Team/Knowledge/Library/Plan) + persona pack(shop/personal/worker).
- **Dashboard = direct chat**: 대시보드 안에서는 모든 에이전트와 직접 대화.
- **Slack/Discord = orchestrated**: 사용자 진입점은 Semi/Colony로만. 실제 작업은 내부 라우팅/위임.
- **고객 설치형**: `semo cli` 설치형 기본 지원.
- **Storage pluggable**: Core DB(Postgres/SQLite) + Obsidian/Notion 미러링.

## 1. 런타임 토폴로지

```
                    ┌─────────────────────────── SEMO Tenant (고객 1) ───────────────────────────┐
  [고객 브라우저] ──https──▶ [Next Dashboard (container)] ──pg──▶ [appdb: public.*]  (테넌트/직원/활동/결제/persona)
        │  /my* direct-chat          │                         └──pg/semo schema──▶ [KB: knowledge_base]
        │                            │
        │                            └──(NEW) Runtime Bridge──▶ [SEMO Runtime (host)] ──▶ [Agent workers]
        │                                  HTTP API OR shared vol      │  mailbox(inbox/outbox jsonl)
        │                                                              ▼
  [Slack/Discord] ──socket──▶ [slack-router / discord-router (cmux pane)] ──Semi/Colony orchestrator──▶ inbox/outbox ──▶ workers
                                                                              │
                                                            [Storage drivers: KbStore] ── PG | SQLite | Obsidian | Notion(mirror)
```

- **Dashboard**(`packages/semo-dashboard`): Next 16, container 배포. 데이터는 appdb(pg.Pool/DATABASE_URL), 인증은 Supabase(분리). KB는 `semo.knowledge_base`(같은 pg).
- **SEMO Runtime**(host): cmux pane의 slack-router/discord-router + 봇 세션(OpenClaw/Hermes/cmux). agent-mailbox(`~/.semo/mailbox/{bot}/inbox.jsonl`,`outbox.jsonl`).
- **Storage drivers**: `KbStore` 인터페이스(`packages/kb-core`) + 어댑터(`kb-pg`, obsidian, notion). CLI `semo init`이 driver 선택, `kb-mirror`가 PG↔Obsidian 양방향.
- **Gateways**: SlackGateway/DiscordGateway → router → Semi/Colony(Hermes) → 봇 위임.

### 1.1 핵심 갭 — Dashboard ↔ Agent 브릿지 (direct-chat 전제)

대시보드는 **container**, agent-mailbox는 **host 파일시스템**. 컨테이너가 호스트 jsonl에 직접 접근 불가.
→ direct-chat은 **런타임 브릿지** 필요. 선택지:

- **(권장) Runtime HTTP endpoint**: SEMO Runtime이 `POST /agent/{id}/message` + SSE `/agent/{id}/stream`을 노출(내부 토큰 인증). 대시보드 `/api/my/chat`이 프록시.
- (대안) **shared volume**: 대시보드 컨테이너에 mailbox 볼륨 마운트 → 대시보드가 inbox write/outbox tail. 설치형(단일 호스트)에 적합.
- 설치형(고객 self-host): 대시보드+런타임 동일 호스트 → shared volume 또는 localhost HTTP가 자연스럽다.
  **현재**: 브릿지 미구현. 본 작업은 대시보드측 **API 계약 + UX 경로 + drivertype 분기**를 스캐폴드하고, 런타임 endpoint/볼륨은 인프라 액션으로 분리(아래 §6).

## 2. 채널 정책 — direct vs orchestrated

| 채널              | 진입점                                    | 라우팅                                         | enforcement                                                                                                      |
| ----------------- | ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Dashboard /my** | 사용자가 **임의 에이전트** 직접 선택·대화 | `/api/my/chat` → 해당 에이전트 worker          | tenant 소유 직원만 대화 가능(설치된 agent_installs)                                                              |
| **Slack/Discord** | **Semi/Colony만** (@Semi/@Colony 멘션)    | Semi=ROUTE→봇 inbox 위임, Colony=SEARCH/CREATE | slack-router `handleOrchestrator`만 사용자 멘션 처리; 그 외 봇멘션은 normal 라우팅(내부) — 사용자 자유 멘션 차단 |

- **이유**: Slack/Discord는 공용/팀 채널 → 오케스트레이터가 의도·권한·맥락을 판단해 위임(스팸/오용 방지). 대시보드는 인증된 단일 테넌트 컨텍스트 → 직접 대화 안전.
- enforcement 위치: `packages/slack-router/src/index.ts` `handleSlackMessage`/`handleOrchestrator`(§4 감사 대상).

## 3. tenant / user / persona resolution (SSR 일관)

우선순위(서버에서 1회 결정 → 화면 prop 주입; 클라 useSearchParams로 ?p= reactive):

1. **tenant**: `resolveTenantSlug()` — Supabase 세션 user → `tenants.owner_user_id` → 없으면 `DEMO_TENANT`(공개 쇼케이스). (`lib/customer/data.ts`)
2. **viewer role**: `/api/auth/me` → `profile`(user_profiles=팀원/admin) + `tenantSlug`/`isCustomer`. (`lib/auth/provider`)
3. **persona**: `resolvePersonaId(searchParams, {userId, tenantSlug})` — **URL `?p=` > `customer_user_settings`(처음 선택) > `customer_tenant_settings`(테넌트 기본) > fallback `shop`**. (`lib/customer/persona/resolve.ts`)

- **SSR 일관성**: 서버가 resolve한 persona를 초기 prop으로 주입 + 클라가 `?p=`를 `useSearchParams`로 derive(둘 다 같은 우선순위) → 새로고침/soft-nav 모두 일치.
- **모드(어드민)**: admin은 셸 토글로 모든 persona(?p= preview) + 운영팀(내부 툴 `/`). 고객은 처음 선택값 고정.

## 4. Storage drivers (pluggable)

- `KbStore`(`kb-core`): get/search/upsert/delete/watch/list/count/listDomains. 어댑터: `PgKbStore`(완성), SQLite/Obsidian(완성), Notion(미러).
- `semo init`: profile별 `kb.driver`(postgres/sqlite/obsidian) + `--hybrid`(PG write + Obsidian mirror) + `--obsidian-vault`.
- `kb-mirror`: 양방향 미러(content-hash 멱등 + updated_at tie-break + telemetry). launchd plist 제공.
- 대시보드: 현재 `lib/core/kb.ts`는 direct-PG(컨테이너 subdir 빌드 제약으로 KbStore delegate 보류 — kb-core/kb-pg npm 발행 또는 repo-root Docker context 시 재도입).

## 5. Observability

- **commitments**(`bot_commitments`): slack-inbox/cron/claude-code-local 진입·마감, runtime_source, 24h stale reaper. 대시보드 `/orchestrator-flow` + SSE.
- **SSE**(`/api/bots/stream`): PG LISTEN `semo_commitment_change`(migration 124) + 폴링 폴백(>= 커서 + 경계 dedup).
- **direct-chat 액션 로그**(NEW 제안): `agent_activity`에 source='dashboard-chat' 행 적재 → Home 활동피드/KB에 반영.
- **failure escalation**: runtime serve가 timeout/error 시 outbox `metadata.failed` → commitment failed 마감.

## 6. 외부/인프라 액션 (사용자 1줄 요청 — 자율 불가 지점)

- **direct-chat 런타임 브릿지**: 설치형은 대시보드+런타임 동일 호스트 가정 → SEMO Runtime에 내부 HTTP endpoint(또는 mailbox shared volume). 인프라 결정 필요.
- **dev/prod DB 마이그레이션**: 010/011/012를 prod DB 적용(seed는 dev 전용).
- **OAuth/결제**: 포트원/팝빌 크리덴셜(이전 design-request 참조).

## 7. 트레이드오프

- direct-chat을 **API 계약+UX부터** 스캐폴드(런타임 브릿지는 분리) → 대시보드측은 완성, 실제 round-trip은 브릿지 배포 후 활성. 장점: 대시보드 독립 진행. 단점: 브릿지 전엔 chat이 "대기/모의" 상태.
- persona = **표현/추천 레이어**(실데이터 보존), 전체 콘텐츠 스왑 아님(design-request 결론).
