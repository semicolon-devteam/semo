# Base Agent 행동 SoT + 고객 전파 아키텍처 설계

> 작성: 2026-06-02 · 트리거: operator를 슬랙에 붙이되 "Mark의 수정이 고객 환경에도 공통 적용·업데이트" 요구.
> 선행: `2026-06-02-semi-colony-improvements-design.md` (operator/SOUL 1차). 본 문서는 그 SoT를 **DB로 승격 + 고객 전파**까지 확장.

## 0. 문제 재정의 (확인된 현실)

- **프로토타입 런타임 (현존)**: Semi/Colony = `slack-router` + hermes 프로파일(`~/.hermes-semo-canary/profiles/semo-{semi,colony}`). 단일 공유 인스턴스. 행동 = SOUL.md.
- **고객(제품) 런타임 (미존재)**: `agent_listings`(카탈로그)·`agent_installs`(테넌트가 채용한 봇 참조)·`customer_user_settings`(shop/personal/worker) 만 존재. **per-tenant 봇 런타임 없음. install에 행동 저장 없음. publishing(008)은 DRAFT.**
- 따라서 "수정이 고객 환경에 적용"은 (a) 행동 SoT가 한 곳이어야 하고 (b) 고객 런타임이 그 SoT를 읽어야 하며 (c) 버전 업데이트 전파 경로가 있어야 한다 — **현재 셋 다 없음.**

## 1. 목표 아키텍처 (DB = 행동 SoT)

```
        ┌──────────────────────────────────────────┐
        │  semo.agent_personas  (NEW, 행동 SoT)      │
        │  slug · soul_md · version · updated_by ... │
        └──────────────────────────────────────────┘
            ▲ edit(컨펌)        │ resolve(slug→soul_md@version)
            │                   ├──────────────┬───────────────────┐
     ┌──────┴──────┐     ┌──────▼──────┐  ┌────▼─────┐      ┌───────▼────────┐
     │  operator   │     │ prototype   │  │ publish  │      │ customer 런타임 │
     │ (Slack,관리) │     │ sync-personas│  │→listings │      │ (per-tenant)   │
     │  DB 편집     │     │ →hermes SOUL │  │          │      │ install→resolve │
     └─────────────┘     └─────────────┘  └──────────┘      └────────────────┘
```

**SoT = `semo.agent_personas`** (신규 core 테이블). 프로토타입 SOUL.md도, 고객 install도 **모두 여기서 파생**. 3자 동기화(DB=SoT) 준수.

## 2. 데이터 모델

### 2.1 `semo.agent_personas` (마이그레이션 125, core)

```
slug            text PK            -- 'semi','colony','jumuni'(주문이) ...
display_name    text
soul_md         text NOT NULL      -- 행동 정의(=현 SOUL.md 본문)
version         int  NOT NULL DEFAULT 1
status          text DEFAULT 'active'  -- active|deprecated
updated_by      text               -- 'mark'|'reus'|... (감사)
updated_at      timestamptz
created_at      timestamptz
```

- 프로토타입 semi/colony 의 현 SOUL.md 본문을 seed.
- 편집 = soul_md 갱신 + version++ + updated_by 기록. 이력은 `agent_persona_revisions`(아래).

### 2.2 `semo.agent_persona_revisions` (이력/롤백)

```
id uuid PK · slug · version · soul_md · updated_by · note · created_at
```

매 편집마다 한 행 append → 롤백·감사·diff 근거.

### 2.3 `agent_installs` 확장 (dashboard, 전파 바인딩)

```
ALTER agent_installs ADD persona_slug text
ALTER agent_installs ADD pinned_version int NULL  -- NULL=latest 추종, 값=고정
```

- `pinned_version IS NULL` → base 최신 version 자동 추종(update-push 자동).
- 값 지정 → 고정(파괴적 업데이트 차단). 테넌트별 override는 향후 `agent_install_overrides`(P3+, YAGNI 보류).

## 3. 전파 의미론 (publish / install / update-push)

- **publish**: `agent_personas`(slug) → `agent_listings`(agent_slug) 카탈로그 노출. listing은 표시 메타(display/role/avatar/price), 행동은 persona가 SoT. (008 DRAFT를 이 모델로 확정)
- **install**: 테넌트가 채용 → `agent_installs`(persona_slug, pinned_version=NULL). 행동은 install 시점에 복제하지 않고 **런타임에 persona에서 resolve**(항상 최신/핀 기준).
- **update-push**: operator가 base persona version++ → `pinned_version IS NULL` 인 모든 install은 다음 resolve에서 자동 신버전. 핀된 install은 "업데이트 가능" 알림만.

## 4. 구성요소 분해 (Phase)

### P1 — 행동 SoT(DB) + operator(Slack 관리채널) 편집 + 프로토타입 sync [본 작업 1차 구축]

- 125 마이그레이션(`agent_personas`,`agent_persona_revisions`) + semi/colony seed.
- `semo` CLI 또는 dashboard 내부 lib에 persona read/write(+revision) 헬퍼.
- `sync-personas` 를 **DB→hermes SOUL.md** 로 전환(파일 SoT→DB SoT). 파일(personas/\*.SOUL.md)은 seed/bootstrap 용도로 격하.
- operator: tool-enabled hermes(파일/터미널), cwd=repo, **지정 관리 채널에서만** 트리거(누구나 그 채널 내). 흐름: 현행 읽기→diff 제안→컨펌→`agent_personas` 갱신(version++,revision append)→sync-personas→"반영됨" 보고.
- 라우팅: operator 전용 Slack App 없음 → Semi 앱 수신 메시지 중 `OPERATOR_ADMIN_CHANNEL` 에서 온 것 + `@오퍼레이터`/`operator` 트리거 → `handleOrchestrator(operator cfg)`.

### P2 — publish/install 바인딩 [데이터 모델 구축]

- 008 DRAFT 확정 적용(listings/installs) + `agent_installs.persona_slug/pinned_version`.
- `/api/my/agents/install` 이 persona_slug 채우도록 + listing↔persona seed.

### P3 — update-push [전파 로직]

- version bump 시 latest-추종 install 자동 반영(런타임 resolve가 최신 읽음) + 핀 install 알림 큐.
- 대시보드 "업데이트 가능" 표시(향후 UI).

### P4 — 고객 봇 RUNTIME [⚠️ 그린필드 — 별도 설계 스파이크 필요]

- per-tenant Semi/Colony 가 **고객 채널(tenant_channels: slack/google 등)에서 실제 응답**하는 런타임.
- 미결정 핵심: (a) 멀티테넌트 중앙 실행 vs per-tenant 격리, (b) 봇 LLM auth 모델(테넌트별? 공용?), (c) 채널 어댑터(고객 슬랙/카카오/구글), (d) persona resolve 시점(콜드/캐시).
- **본 설계는 P4를 "resolve = agent_personas(slug,version) 에서 soul_md 로드" 계약까지만 고정**. 실제 런타임 구현은 독립 설계 문서로 분리(블라인드 구축 금지).

## 5. 이번 라운드 구축 범위 (정직한 선긋기)

- **구축**: P1 전체(DB SoT + operator Slack 편집 + DB→프로토타입 sync) + P2 데이터 모델(installs 바인딩 컬럼·listing seed) + P3 의 resolve 계약.
- **설계만(구축 보류)**: P4 고객 런타임(그린필드, 별도 스파이크). update-push의 실제 효과는 P4 런타임이 생겨야 관측 가능.
- 즉 **"Mark가 슬랙에서 base 행동을 수정 → DB SoT 갱신 → 프로토타입 즉시 반영 + 미래 고객 install이 읽을 바로 그 소스" 는 이번에 완성.** "이미 설치된 고객 봇에 실시간 전파"는 P4 런타임 완성 시 자동 작동(계약상 보장).

## 6. 보안/위험

- operator = 슬랙→봇행동 변경. 관리 채널 게이트(`OPERATOR_ADMIN_CHANNEL`) + 컨펌 게이트(SOUL) + revision 감사 로그. tool-enabled hermes는 cwd·toolset 최소화.
- 토큰 사고 재발 방지: operator 프로파일은 **자체 OAuth 로그인**(프로파일 간 토큰 복사 금지 — 2026-06-02 incident).
- DB 편집은 version++/revision append 로 항상 롤백 가능.

## 7. 성공 기준

1. Mark가 관리 채널에서 "Colony 좀 덜 깐깐하게" → operator가 diff 제안→컨펌→`agent_personas` 갱신→프로토타입 Colony 즉시 신행동.
2. `agent_personas` 가 semi/colony 행동의 단일 SoT(프로토타입 SOUL.md는 여기서 파생).
3. `agent_installs` 가 persona_slug/version 으로 바인딩 → 고객 런타임(P4) resolve 계약 충족.
4. 모든 편집이 revision 이력으로 감사·롤백 가능.
