# Customer 대시보드 v5 → SEMO Agents 환경 연동 분석

> 작성: 2026-05-28 (reus 요청)
> 선행: Claude Design 핸드오프(`SEMO 대시보드-handoff`)를 `packages/semo-dashboard` 에 고객용으로 이식·퍼블리시 완료.
> 관련: [트랙 B Pre-design 결정문](./2026-05-27-semo-dashboard-v5-track-b-predesign.md) · [Customer 봇 페르소나](./2026-05-27-customer-bot-personas.md)

---

## 0. 지금 퍼블리시된 상태 (Phase 0 = 쇼케이스)

- 라우트 그룹 `app/(customer)/` 신설. 기존 36개 내부 운영툴 라우트는 그대로.
- `components/AppChrome.tsx` 가 `/my*` 에서 내부 `GlobalNav` 를 숨기고, `(customer)/layout.tsx` 가 자체 풀스크린 shell(`tokens.css` + AppShell) 제공.
- 5개 화면 라우트 (모두 dev 서버 HTTP 200 확인):
  | URL | 컴포넌트 | 브리프 |
  |---|---|---|
  | `/my` | ScreenHome | §4.6 메인 대시보드 |
  | `/my/team` | ScreenTeam | §4.2 내 AI 직원 |
  | `/my/knowledge` | ScreenKnowledge(2d) | §4.1 가게 지식 그래프 |
  | `/my/library` | ScreenLibraryList | §4.3 직원 채용 |
  | `/my/plan` | ScreenPlan | §4.4 요금제 |
- 이식 방식: 프로토타입 `.jsx` 를 ES 모듈로 변환(`window` 전역 → import/export, `'use client'`). `tsconfig` 가 `.jsx` 를 타입체크에서 제외(`allowJs`)하므로 tsc 마찰 없음. lucide·react-force-graph 등 **신규 의존성 0** (프로토타입이 자체 SVG/Icon 사용).
- **모든 데이터가 화면에 하드코딩된 mock** (정민 카페, 7봇 페르소나, 가짜 매출/활동/그래프).
- 인증: `/my*` 를 middleware publicPath 에 임시 추가 (mock 쇼케이스라 로그인 우회). **실데이터 연동 시 반드시 재-게이팅.**

### 아직 이식 안 한 것 (Phase 0 범위 밖)

- Library 상세 / 채용 마법사 3스텝 (`ScreenLibraryDetail`, `ScreenLibraryRecruit` 컴포넌트는 이식됐으나 라우트 미연결 — `/my/library/[slug]` 필요)
- Knowledge 3D 토글, 다크모드 토글 (컴포넌트는 prop 지원, UI 토글 미배선)
- 모바일 화면(`screen-mobile`), Provider 화면(`screen-provider`), 디자인 캔버스/토큰/무드보드 메타 화면 — 미이식
- 봇 아바타는 SVG 캐릭터(프로토타입). 실제 페르소나 일러스트(DesignClaw)로 교체 대기

### 알려진 블로커 (제 변경과 무관)

- `npm run build`(프로덕션) 는 현재 `lib/core/kb.ts` 의 **진행 중 KBStore 리팩토링** 타입에러(`USE_KBSTORE`/`getKbStore`/`kbEntryToKBItem`/`ListOpts` 미정의)로 실패. 세션 시작 시점부터 `M` 상태였던 타사 WIP. dev 서버는 정상. 이 파일 owner 가 리팩토링 마무리해야 프로덕션 빌드 green.

---

## 1. "SEMO Agents 환경" 이란 (연동 대상)

이 대시보드가 보여주는 모든 것의 SoT 는 결국 **에이전트 런타임 + KB + 테넌시**다. 연동이란 각 화면의 mock 을 다음 실데이터로 바꾸는 작업:

| 개념 (Customer 용어)        | 실제 SEMO 자산                                    | 위치                                    |
| --------------------------- | ------------------------------------------------- | --------------------------------------- |
| 내 AI 직원 1명              | `agent_installs` 1행 (listing 인스턴스)           | 트랙 B `008_agent_library_publishing`   |
| 직원이 한 일 (활동 피드)    | 에이전트 런타임의 실행 로그 + `bot_commitments`   | `semo.bot_commitments`, 에이전트 런타임 |
| 가게 지식 (KB 그래프)       | `semo.knowledge_base` (tenant 스코프) + 그래프 뷰 | 트랙 B `009_kb_graph_views`             |
| 채용 가능 직원 (라이브러리) | `agent_listings` (visibility=preset/community)    | 트랙 B `008`                            |
| 사장님이 해줄 일 (nudge)    | 에이전트가 사람 승인 대기 중인 항목               | 신규: `agent_pending_actions` 테이블    |
| 요금제/사용량               | `tenant_subscriptions` + `usage_meters` (PortOne) | 트랙 B `010_billing`(미작성)            |

→ "새 SEMO Agents 환경" = Agent Factory 로 정의·배포되는 에이전트들 + 그 실행 런타임. 대시보드는 그 런타임의 **고객용 관제탑**이 된다.

---

## 2. 화면별 데이터 바인딩 작업

### 2.1 Home (`/my`) — 가장 많은 연동 지점

| mock 요소                         | 실데이터 소스                                              | 필요 작업                                                         |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| "정민 사장님" 인사                | `tenants.display_name` + 로그인 사용자                     | 테넌트 컨텍스트(§3)                                               |
| 상단 3 stat (응대/매출/KB)        | 집계 쿼리 (agent_installs 활동 + 외부 연동 매출 + KB 증분) | `GET /api/my/home/stats`                                          |
| 활동 피드                         | 에이전트 실행 로그 (시간순)                                | `GET /api/my/activity?cursor=` + 실시간(§4)                       |
| "사장님이 해주셔야 할 일" (nudge) | 사람 승인 대기 큐                                          | 신규 `agent_pending_actions` + `GET /api/my/nudges` + 승인 `POST` |
| "지금 일하고 있어요"              | 에이전트 실시간 상태                                       | SSE/WS 스트림(§4)                                                 |
| 이번 주 가게 지식 미리보기        | `kb_graph_snapshot(since=7d)` 요약                         | 트랙 B `009` RPC                                                  |
| 응대 사용량 진행률                | `usage_meters` 현재값 / 플랜 한도                          | 트랙 B `010`                                                      |

### 2.2 Team (`/my/team`)

| mock                        | 실데이터                                              | 작업                                                  |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 7봇 카드 그리드             | `agent_installs` WHERE tenant + JOIN `agent_listings` | `GET /api/my/agents`                                  |
| 각 카드 "오늘 한 일/만족도" | 에이전트별 일일 집계                                  | stats 쿼리                                            |
| 상태(일하는중/대기/오류)    | 런타임 헬스                                           | 상태 스트림(§4)                                       |
| "말 걸기/쉬게 하기/설정"    | install 제어                                          | `PATCH /api/my/agents/{id}` (pause/resume), 채팅 진입 |
| 우측 상세 패널              | install 상세 + 최근 KB + 도구                         | `GET /api/my/agents/{id}`                             |

### 2.3 Knowledge (`/my/knowledge`) — KB 그래프

| mock                        | 실데이터                                   | 작업                                                                                                 |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 노드/엣지 (현재 정적 SVG)   | `kb_graph_snapshot(domains, since, limit)` | 트랙 B `009` MV+RPC, `GET /api/my/kb/graph`                                                          |
| 카테고리 필터·시간 슬라이더 | 동일 RPC 파라미터                          | 클라 바인딩                                                                                          |
| 노드 클릭 → 상세            | `semo.knowledge_base` 단건                 | `GET /api/my/kb/{id}`                                                                                |
| 2D/3D 토글                  | **react-force-graph 신규 도입**            | `npm i react-force-graph-2d react-force-graph-3d` + 동적 import(SSR off) + 정적 SVG → 실 렌더러 교체 |
| tenant 격리                 | KB 에 tenant_id 선행 필요                  | `cli/migrations/108_*` (KB tenant 컬럼)                                                              |

### 2.4 Library (`/my/library`)

| mock                                  | 실데이터                                                             | 작업                                                            |
| ------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| 카테고리 캐러셀                       | `agent_listings` visibility=preset/community, review_status=approved | `GET /api/my/library`                                           |
| 봇 상세(자기소개/스킬/연동/리뷰/가격) | listing + `agent_reviews`                                            | `GET /api/my/library/{slug}` + `/my/library/[slug]` 라우트 추가 |
| 채용 마법사 3스텝                     | install 생성 + OAuth 연동(카카오/스마트스토어)                       | `POST /api/my/agents/install` + 통합 OAuth 플로우               |
| "내 봇 공유하기"                      | community 제출 → 검수 큐                                             | `POST /api/my/library/submit` → Provider 검수(트랙 B `008`)     |
| 가격 영향(무료/addon/plan)            | listing.price_model × 현재 플랜                                      | `010_billing` join                                              |

### 2.5 Plan & Billing (`/my/plan`)

| mock                         | 실데이터                                  | 작업                                           |
| ---------------------------- | ----------------------------------------- | ---------------------------------------------- |
| 현재 플랜/사용량/다음 결제일 | `tenant_subscriptions` + `usage_meters`   | 트랙 B `010` + `GET /api/my/billing`           |
| 플랜 비교/업·다운그레이드    | `billing_plans` + PortOne 빌링키          | `POST /api/my/billing/change` + PortOne SDK    |
| 결제수단 관리                | PortOne 빌링키 등록/교체                  | PortOne 위젯 + webhook(`/api/billing/webhook`) |
| 세금계산서/사업자등록        | `tenants.business_registration_no` + 팝빌 | 팝빌 API 연동                                  |

---

## 3. 인증 · 테넌시 (모든 화면 선행 조건)

1. **`/my*` 재-게이팅**: middleware publicPath 에서 제거, 미로그인 → `/login` 복귀.
2. **테넌트 컨텍스트 도입**: 트랙 B `007_multi_tenancy` 적용 → `lib/auth/provider.tsx` 에 `currentTenant`/`tenants[]` 추가 → middleware 가 `X-Tenant-Id` → `SET LOCAL app.current_tenant_id` 주입.
3. **워크스페이스 스위처 배선**: 디자인의 사이드바 스위처 + Topbar Customer/Provider 토글을 실제 tenant 전환에 연결 (admin=`is_provider` 만 Provider 토글 노출).
4. **SSR 데이터 페치**: 현재 화면은 클라 컴포넌트(`'use client'`)에 mock 내장. 실데이터는 서버 컴포넌트에서 페치해 prop 주입하거나 SWR/React Query 로 클라 페치. 권장: 페이지(서버)에서 초기 스냅샷 페치 → 화면 컴포넌트에 prop, 실시간 부분만 클라 스트림.

---

## 4. 실시간 (활동 피드 · 봇 상태)

- "지금 일하고 있어요", 활동 피드, 펄스 애니메이션은 실시간성이 핵심.
- 옵션: SSE (`/api/my/stream`) — 이미 레포에 `app/api/bots/stream/` 패턴 존재(untracked) → 재활용. 또는 Supabase Realtime(테넌트 채널 구독).
- 에이전트 런타임이 실행 이벤트를 발행 → 대시보드가 구독. 런타임↔대시보드 이벤트 버스 계약 필요.

---

## 5. 에이전트 페르소나 정합성

- 디자인이 고른 7봇: 주문이·회계도리·알리미·채워·셈이·단골이·비서.
- [Customer 봇 페르소나 카탈로그](./2026-05-27-customer-bot-personas.md) 의 12개와 **부분 불일치** (이름·역할 상이). → 하나로 통일 필요 (PlanClaw 가 페르소나 확정 → `agent_listings` 시드).
- 내부 7봇(semiclaw 등)은 `metadata.audience='internal'` 로 Customer 라이브러리에서 제외 (트랙 B `008` 결정 유지).
- 각 페르소나의 backend = 신규 에이전트 정의(Agent Factory) 또는 기존 봇 재활용. 실행 주체 매핑은 페르소나 문서 §5 참조.

---

## 6. 신규 API 표면 (요약)

```
GET  /api/my/home/stats          홈 상단 3카드
GET  /api/my/activity            활동 피드 (cursor 페이지네이션)
GET  /api/my/nudges              사람 승인 대기
POST /api/my/nudges/{id}/approve 승인/거절
GET  /api/my/stream              SSE: 봇 상태·신규 활동
GET  /api/my/agents              내 직원 목록
GET  /api/my/agents/{id}         직원 상세
PATCH/api/my/agents/{id}         pause/resume/설정
POST /api/my/agents/install      채용(install) 생성
GET  /api/my/kb/graph            KB 그래프 스냅샷
GET  /api/my/kb/{id}             KB 단건
GET  /api/my/library             라이브러리 카탈로그
GET  /api/my/library/{slug}      listing 상세+리뷰
POST /api/my/library/submit      community 제출
GET  /api/my/billing             플랜·사용량
POST /api/my/billing/change      업/다운그레이드
POST /api/billing/webhook        PortOne webhook (멱등)
```

모두 테넌트 스코프 + RLS 의존. 에이전트 토큰 경로(`x-semo-agent-token`)와 구분.

---

## 7. 권장 시퀀싱

1. **기반(블로킹)**: `lib/core/kb.ts` WIP 마무리 → 프로덕션 빌드 green. 트랙 B `007`(테넌시) + `108`(KB tenant_id) 적용.
2. **읽기 전용 연동**: Home stats / Team 목록 / Library 카탈로그 / KB 그래프 — 실데이터 표시 (mock 제거). `/my*` 재-게이팅.
3. **실시간**: 활동 피드 + 봇 상태 스트림.
4. **쓰기/제어**: 채용(install) + nudge 승인 + 봇 pause/resume.
5. **결제**: 트랙 B `010` + PortOne + 팝빌.
6. **미이식 화면**: Library 상세/마법사 라우트, Knowledge 3D(react-force-graph), 모바일, Provider, 다크모드 토글.
7. **페르소나 아트**: DesignClaw 일러스트 교체.

---

## 8. Verification (현재까지)

- 5개 라우트 dev 서버 HTTP 200 + SSR HTML 내 화면 콘텐츠 확인 ✓
- tsc: 내 파일(app/(customer), AppChrome, layout) 에러 0 ✓ (kb.ts 기존 WIP 에러는 별개)
- eslint: 내 파일 0 errors (no-unused-vars 경고 1, 프로토타입 내부 dead var) ✓
- 프로덕션 build: kb.ts WIP 로 차단 — owner 해결 대기 ✗(외부 요인)
- 시각 회귀: Playwright 프로파일 잠김으로 스크린샷 미수행 — HTTP/SSR 콘텐츠로 갈음

---

## 9. 실행 상황 (2026-05-28 dev, "전체 적용" 승인 후)

> 중요 아키텍처 발견: 대시보드는 **데이터=appdb(DATABASE_URL, pg.Pool)**, **인증=Supabase** 로 분리. `DATABASE_URL` 은 로컬 dev DB(`localhost/appdb`, semo 스키마 KB 2552행). `public.user_profiles` 는 Supabase 에만 존재. → 고객 테이블은 appdb `public` 에 두고 user_profiles FK 제거. DRAFT 007/008(Supabase+FK 전제)은 이 아키텍처용 `010_customer_tables.sql` 로 대체.

**완료 (로컬 dev appdb)**

- `migrations/010_customer_tables.sql` — tenants / agent_listings / agent_installs / agent_activity (public, FK 없음, RLS 없음 — tenant 격리는 쿼리 레이어). `scripts/apply-customer-tables.mjs` 로 적용(멱등, localhost 가드).
- 시드: 데모 테넌트 `정민 카페` + 정본 7봇 listings + 7 installs + 6 activity.
- `lib/customer/data.ts` — `getInstalledAgents(tenantSlug)`, `getLibraryListings()` (appdb pg, 오류/빈값이면 [] → 화면 mock 폴백).
- `app/api/my/agents/route.ts` — 실데이터 JSON (검증: 7명, "주문이 · 오늘 23건 응대 · 만족도 98%").
- `/my/team` — 서버에서 `getInstalledAgents()` 직접 페치 → `ScreenTeam(agents)` 주입. **실 시드 데이터 렌더 확인**(옛 mock "12건" → 실데이터 "23건"). ScreenTeam 은 prop 없으면 mock 7명 폴백.
- middleware: `/api/my/` 도 쇼케이스 공개 경로 추가.

**남은 작업 (동일 패턴 반복)**

- Home: `agent_activity` → 활동 피드, installs → "지금 일하고 있어요", stats 집계. ScreenHome 을 prop 구동으로.
- Library: `getLibraryListings()` 이미 있음 → ScreenLibraryList/Detail 을 listings prop 으로.
- Plan/Knowledge: billing 테이블(010 별도)·KB 그래프(009 + react-force-graph) 선행.
- 멀티테넌시: 현재 데모 테넌트 고정(`jeongmin-cafe`). 세션→tenantSlug 주입 + `/my*` 재-게이팅.
- **프로덕션 적용**: 010 은 로컬 appdb 에만 적용됨. prod 배포 시 prod DB 에 010 적용(시드는 dev 전용 — 실제 고객은 가입 플로우로 생성).
