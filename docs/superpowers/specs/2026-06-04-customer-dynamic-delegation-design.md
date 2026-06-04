# 고객 동적 위임 플로우 설계 (Customer Dynamic Delegation)

> 작성: 2026-06-04 · 트리거: Mark(고객)가 "오마이클로드코드 조사"를 Semi에 요청 → Semi가 **내부봇 planclaw로 ROUTE**(orphan, 미처리). 고객 요청은 내부봇이 아니라 **테넌트 에이전트로 동적 해소·실행**되어야 한다.
> 기반 자산: serve-worker 엔진(`runtime serve`, reviewclaw 라이브), mailbox-supervisor, persona envelope, bot_commitments 워크큐, 대시보드 큐 탭.

## 목표 플로우 (사용자 확정)

1. **해소-풀**: 고객 요청 → 현재 테넌트의 에이전트 풀(`public.agent_installs`)에서 적합 에이전트(예: Researcher) 탐색
2. **해소-라이브러리**: 없으면 SemiColony 라이브러리(`public.agent_listings` audience='customer')에서 탐색
   - **2-A 적합 있음**: 테넌트 슬롯 확인 → 가능 시 템플릿 기반 설치(초기값 + 커스텀 온보딩 단계)
   - **2-B 적합 없음**: plain 템플릿으로 신규 에이전트 생성 → **플랫폼 제공자가 인지** → 추후 어드민이 라이브러리 등록 판단
3. **워크큐**: 위임 작업 → 해당 에이전트 워크큐 등록 → 최상단부터 순차 처리. 대시보드에서 큐 가시화. 에이전트가 이미 작업 중이면 Semi가 사용자에게 안내("이미 '###' 처리 중이라, 끝나면 바로 처리해 결과 알려드릴게요")
4. **파이프라인·전달**: 인계 에이전트는 DB 파이프라인으로 진행/완료/결과 기록. Semi는 고객 요청을 지속 모니터링하다 **원 스레드에 결과 전달**

## 현재 상태 (스카우트 확인)

| 자산                                              | 상태                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 에이전트 라이브러리 `public.agent_listings`       | ✅ 7개 소상공인 에이전트(주문이/회계도리/셈이/알리미/단골이/채워/비서), 모두 customer/approved. **Researcher 류 없음** |
| 테넌트 풀 `public.agent_installs`                 | ✅ jeongmin-cafe(7), team-semicolon(5), t-bcd60dadce8e(1)                                                              |
| 테넌트 `public.tenants`                           | ✅ jeongmin-cafe(personal/starter), team-semicolon(team/starter), t-bcd(personal/free)                                 |
| 채널→테넌트 매핑 `public.tenant_channels`(mig014) | ⚠️ 테이블 존재, **0행**(매핑 미적재)                                                                                   |
| 실행 엔진 `runtime serve` (semo.bot_status)       | ✅ 내부봇 동작(reviewclaw 라이브). **customer agent_install 과 미연결**                                                |
| 워크큐 `semo.bot_commitments` + 대시보드 큐       | ✅ bot_id 기준. customer agent 미연결                                                                                  |
| 결과 전달 OutboxReader→Slack 스레드               | ✅ 내부봇 동작. customer 미연결                                                                                        |
| Mark 요청                                         | ⚠️ `cmt-planclaw-...205-z8wr` active orphan. 채널 C0B4V8667PT, 스레드 1780529068                                       |

## 핵심 설계 결정

### D1. 실행 identity = `agent_installs → semo.bot_status` 런타임 프로젝션 (엔진 전면 재사용)

customer agent를 별도 런타임으로 만들지 않는다. **각 활성 `agent_install`을 `semo.bot_status` 한 행으로 프로젝션**(`bot_id = ag_{install_id}` 또는 `{tenant_slug}__{agent_slug}`)하여 기존 serve-worker·supervisor·워크큐·대시보드·OutboxReader가 **변경 없이** 동작하게 한다.

- `bot_status.config = { host_kind, ... }`, persona는 `agent_personas`(또는 listing/definition)에서 envelope로.
- `bot_status.metadata`에 `{ tenant_id, listing_id, install_id, audience:'customer' }` 기록(역추적·격리).

### D2. 워크큐 SoT = `bot_commitments` 재사용

프로젝션된 bot_id로 commitment 생성 → 봇당 동시성 1(advisory lock) → 순차 처리 → 대시보드 큐 탭 그대로. "busy" 판정 = 해당 bot_id에 active commitment 존재 여부.

### D3. host_kind = 고객 에이전트 실행 호스트

소상공인 에이전트(주문이 등)는 도메인 응대형 → hermes-cli(seatless) 또는 openclaw. **Researcher(웹조사형)** = web search 가능한 host 필요(openclaw web.search 또는 hermes + web). MVP는 검증된 openclaw 어댑터 재사용(reviewclaw와 동일 경로) 또는 ollama(무인증, 도구無)로 골격 검증 후 실호스트.

### D4. 채널→테넌트 해소 = `tenant_channels` 적재 + resolver

`resolveTenantForChannel(channel_id)`: tenant_channels(external_workspace_id/channel_type) 조회. MVP는 매핑 1건 시드(Mark 채널→해당 테넌트) + Semi 컨텍스트의 tenant 힌트.

### D5. 에이전트 해소 = `resolveAgentForRequest(tenant, intent)`

요청 의도(키워드/임베딩) → (1) 테넌트 풀의 install들 중 listing.skills/role_label 매칭 → (2) 라이브러리 매칭 → (3) 없음 → 2-B 생성 트리거. MVP는 규칙기반(skills/role 키워드) → 추후 임베딩.

## MVP 슬라이스 (가장 작은 end-to-end, 엔진 재사용)

**목표**: 한 테넌트에 Researcher를 동적 해소(2-B 생성)→실행→Mark 스레드 전달까지 잇는다.

- **P1. 프로젝션 브릿지**: `semo runtime project-install --install <id>` (또는 자동) → agent_install → bot_status 행 생성/동기화(host_kind, persona, metadata). 단위 함수 `projectInstallToBotStatus()`.
- **P2. 해소 레이어**: `resolveAgentForRequest(tenantSlug, intent)` (lib) — 풀→라이브러리→none. none이면 `createPlainAgent(tenantSlug, intentSpec)`(2-B): agent_listing(visibility=draft/internal) + install + 프로젝션 + **platform-provider 알림 레코드**.
- **P3. Semi 라우팅 확장**: Semi가 고객 컨텍스트(tenant 해소됨)에서 internal-bot 대신 **resolveAgentForRequest → 프로젝션 bot_id로 dispatchToInbox**. busy면 안내 메시지. (semi-roster customer 분기를 dispatchable로 승격.)
- **P4. 실행**: 프로젝션 bot_id의 serve-worker(supervisor/standalone) → adapter dispatch → outbox.
- **P5. 전달**: 기존 OutboxReader가 outbox→원 스레드(channel/thread 보존) 포스팅 + commitment done. Semi가 "결과 왔어요" 마감.

## Mark 케이스 적용 (구체 시퀀스)

1. Mark@C0B4V8667PT: "@Semi 오마이클로드코드 조사" → Semi가 tenant 해소(C0B4V8667PT→tenant).
2. `resolveAgentForRequest(tenant, "웹 조사/기술 분석")` → 풀·라이브러리에 Researcher 없음 → **2-B**.
3. `createPlainAgent(tenant, {role:'Researcher', skills:['web-research','analysis'], host_kind:'openclaw'})` → listing(draft)+install+bot_status 프로젝션 + 어드민 알림("새 Researcher 생성됨, 라이브러리 등록 검토").
4. Semi → 프로젝션 bot_id mailbox에 dispatch(원 스레드 C0B4V8667PT:1780529068 보존) + commitment(active).
5. serve-worker → Researcher 실행(웹조사) → outbox.
6. OutboxReader → Mark 스레드에 결과 포스팅 + commitment done. Semi 마감.

> (현 planclaw orphan commitment는 잘못된 경로 — 이 플로우로 대체. 기존 것은 stale 처리.)

## 리스크/주의

- **테넌트 격리**: 프로젝션 bot_status에 tenant_id 명시 + serve-worker가 cross-tenant 데이터 접근 못하게(persona/스킬 범위 한정). 대시보드 큐도 tenant scope.
- **dispatcher "no outbound" 가드**(lib/channels/dispatcher.ts): 고객 자동응답 금지 가드가 이 플로우와 충돌하지 않게 — 결과 전달은 Semi/OutboxReader가 원 스레드 응답(요청에 대한 응답이라 outbound 자동발신과 구분).
- **비용**: 동적 생성 에이전트 남발 방지(슬롯/플랜 한도, 2-B는 어드민 게이트 옵션).
- **host 인증**: openclaw 호스트는 OAuth 공유 — reviewclaw 검증대로 동시성 안전하나 테넌트별 호스트 전략 필요(장기).

## 범위 밖 (후속)

- 임베딩 기반 의도→에이전트 매칭(MVP는 규칙기반).
- 어드민 라이브러리 등록 UI(2-B 알림→승인).
- 테넌트별 호스트/모델/비용 정책.

## 검증

1. 프로젝션: agent*install 1건 → bot_status 행 생성 → `runtime serve --bot ag*{id} --once`로 dispatch 확인.
2. 해소: resolveAgentForRequest 단위테스트(풀히트/라이브러리히트/none→2-B).
3. E2E(canary): fresh 메시지→해소→(생성)→프로젝션→serve→outbox→스레드(benign 채널) 확인. 기존 reviewclaw 패턴.
