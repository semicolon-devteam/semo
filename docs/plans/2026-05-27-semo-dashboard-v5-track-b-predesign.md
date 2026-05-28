# SEMO Dashboard v5 — Track B Pre-design 결정문 (통합)

> 발의: reus (2026-05-27)
> 맥락: [SEMO Dashboard v5 개편 플랜](/Users/reus/.claude/plans/ultrathink-semo-renewel-pane-typed-meadow.md) 의 트랙 B 8개 항목 중, **디자인 시안 없이도 결정 가능한 항목들을 선행 처리** 한다. Claude Design 시안과 무관하게 백엔드·인프라 구조가 먼저 깔려 있어야 디자인 → 구현 전환이 빠르다.
> 이 문서는 7개 결정의 통합 기록. 각 결정은 후속 마이그레이션·문서로 갈래친다.

---

## §0 결정 요약 표

| #   | 항목                          | 결정                                                                                                                                       | 산출물                                                     |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | 멀티테넌시 모델               | `tenants` + `tenant_members` 신규 + `user_profiles.is_provider`. 기존 admin → provider 자동 부여. 신규 가입 → personal tenant 자동.        | `migrations/007_multi_tenancy_DRAFT.sql`                   |
| 2   | KB 그래프 데이터 파이프라인   | 노드=KB row, 엣지=hierarchy(view) + semantic(MV 1h) + explicit(view). 노드당 top-8 semantic edge. `kb_graph_snapshot()` RPC.               | `migrations/009_kb_graph_views_DRAFT.sql`                  |
| 3   | Agent Library 권한·배포 모델  | `agent_listings` (visibility: preset/community/private + review_status) + `agent_installs` + `agent_reviews`. RLS 로 가시성 enforcement.   | `migrations/008_agent_library_publishing_DRAFT.sql`        |
| 4   | 결제 스택                     | **포트원 V2** 1순위 (수수료 무료 구간 + 빌링 통합 + 벤더 락인 회피). 토스페이먼츠 직결 2순위.                                              | 본 문서 §4 + 후속 `010_billing_DRAFT.sql` (별도 작성 예정) |
| 5   | 모바일/데스크탑 패키징        | Phase 0 PWA 강화 → Phase 1 Capacitor(iOS/Android) → Phase 2 Tauri(macOS/Windows).                                                          | [별도 문서](./2026-05-27-semo-dashboard-app-packaging.md)  |
| 6   | Customer 봇 페르소나 카탈로그 | 7봇과 독립된 12개 Customer 페르소나 초안 (주문이·회계봇·재고봇 등). PlanClaw 가 향후 콘텐츠 보완.                                          | [별도 문서](./2026-05-27-customer-bot-personas.md)         |
| 7   | 인큐베이터 분리               | `incubator.semo.team` 서브도메인 분리 (옵션 A). 메인 대시보드 사이드바엔 외부 링크 1개. 현 `/projects` 트리는 인큐베이터 전용 앱으로 이전. | 본 문서 §7 + 후속 라우팅 마이그레이션                      |

---

## §1 멀티테넌시 모델

### 결정

- `tenants` 신규: `id`, `slug`, `display_name`, `tenant_type IN (personal|team|provider)`, `owner_user_id`, `business_registration_no`, `current_plan_id`.
- `tenant_members` 신규: `(tenant_id, user_id, member_role IN (owner|admin|member))`.
- `user_profiles` 확장: `is_provider BOOLEAN` (세미콜론 팀원만), `default_tenant_id UUID`.
- 기존 RLS 헬퍼 `is_admin()` 유지 + 신규 `is_tenant_member(tid)`, `is_tenant_admin(tid)`, `is_provider()`, `current_tenant_id()` (set_config 기반).
- 백필: 기존 admin → `semicolon` provider tenant 자동 생성 + 멤버 등록. member → 각자 `user-{uuid}` personal tenant.
- 신규 가입 트리거: personal tenant 자동 생성 + default 지정.

### Why

- v5 Customer/Provider 분기의 토대. 한 계정이 여러 tenant 에 속할 수 있어야 가족 공동 운영·팀 협업·Provider 모드 토글이 모두 같은 구조에서 처리된다.
- 기존 RLS 패턴(`is_admin()` SECURITY DEFINER) 을 그대로 확장 — 코드 변경 최소.
- 단일 테넌트 시스템에서 점진적으로 이행하기 위한 백필이 필수. 무중단 전제.

### 영향 / 후속

- `packages/cli/migrations/108_*.sql` 가 필요: `semo.knowledge_base`, `semo.action_items`, `semo.bot_commitments`, `semo.agent_definitions` 에 `tenant_id` 추가 + 백필. 이건 본 마이그레이션과 짝이 됨.
- `packages/semo-dashboard/middleware.ts` 에 `X-Tenant-Id` 헤더 → `SET LOCAL app.current_tenant_id = ...` 주입.
- `lib/auth/provider.tsx` 에 `currentTenant` 와 `tenants[]` 컨텍스트 추가.
- `GlobalNav` 에 워크스페이스 스위처 + provider 토글 UI 추가 (디자인 시안 기다림).

### 위험

- 백필 DO 블록이 무거움. 사용자 수가 적은 지금이 적기 (`user_profiles` row 수 [추정] < 20).
- `current_tenant_id()` 가 세션 변수 기반이므로 connection pooling 환경에서 stale 위험. SET LOCAL + RPC 직접 호출 패턴 권장.

---

## §2 KB 그래프 데이터 파이프라인

### 결정

- 노드: `semo.knowledge_base` row 1:1. `kb_graph_nodes` VIEW 로 노출. `node_kind` (decision/incident/kpi/section/feature/pipeline/identity/other) 로 시각화 컬러 매핑.
- 엣지 3종 + 통합 VIEW `kb_graph_edges`:
  1. **hierarchy** — `sub_key` path 부모-자식 + `metadata.parent_domain` 도메인 계층. 실시간 VIEW.
  2. **semantic** — 임베딩 코사인 유사도 노드당 top-8 (`weight >= 0.70`). **Materialized View, 1h 주기 REFRESH**.
  3. **explicit** — `metadata.references[]` (수동 또는 봇 자동 추가, 향후 활용). 실시간 VIEW.
- UI 진입점 RPC: `kb_graph_snapshot(domains, since, limit)` → `{nodes, edges}` JSONB 한 번에 반환.
- Refresh: `refresh_kb_graph_semantic()` 함수 + Supabase pg_cron 또는 SEMO 크론.

### Why

- 현재 `knowledge_base` 는 row 간 명시적 엣지가 없음. 임베딩 유사도가 사실상 유일한 의미적 관계 정보.
- 임베딩 self-join 은 O(n²) 위험 — LATERAL JOIN + top-N 로 노드당 비용 제한. HNSW 인덱스가 ANN 처리.
- semantic 엣지는 변동 적음 (KB 업서트 트리거가 임베딩만 갱신) → MV 로 캐시. UI 호출마다 계산하면 부하.
- 명시적 references[] 는 미래 봇이 글 쓸 때 자동 추가하면 점차 그래프가 풍부해짐. 현재는 빈 배열이 디폴트.

### 영향 / 후속

- frontend: react-force-graph 또는 vis-network 도입 (디자이너 추천 대기).
- `kb_graph_snapshot()` 결과를 SWR 로 5분 캐싱.
- tenant 격리: §1 의 KB tenant_id 추가 후, VIEW 의 WHERE 절에 `tenant_id = current_tenant_id()` 자연 적용.
- 노드 5,000개 초과 시 클러스터링 view 추가 (Louvain·Leiden 알고리즘은 별도 워커. Phase 2).

### 위험

- MV REFRESH 가 KB 1만 row 에서 [추정] 30-60초 걸릴 수 있음. CONCURRENTLY 사용으로 reads 비차단.
- 클라이언트로 1,000 노드 전송 시 페이로드 [추정] 500KB~1MB. gzip + lazy preview loading 필요.

---

## §3 Agent Library 권한·배포 모델

### 결정

- 3개 신규 테이블 (`agent_listings`, `agent_installs`, `agent_reviews`).
- `visibility` 3단계: `preset` (세미콜론 큐레이션), `community` (사용자 공유 + 검수 통과), `private` (본 tenant 만).
- `review_status` 5단계: `draft → pending → approved/rejected → deprecated`.
- 사용자 제출 봇은 `community` + `pending` 으로 진입 → Provider 검수 → `approved` 일 때만 모든 사용자에게 노출.
- RLS 정책이 visibility 별 노출을 enforcement (코드 분기 X).
- 가격 모델 3단계: `included` (현 플랜에 포함), `addon` (월 추가 금액), `plan_required` (특정 플랜부터). plans 마이그레이션 (010\_\*) 과 join.
- 집계 (install_count·rating_avg·rating_count) 는 트리거로 자동 갱신.

### Why

- "프리셋 + 사용자 공유" 라이브러리 (사용자 confirmed 옵션 3) 를 실현하려면 검수 큐와 가시성 분기가 핵심.
- RLS 로 강제하면 API 코드에서 분기 누락 위험 제거.
- 채용 마법사가 곧 install row 1개 + integration OAuth 토큰 저장. 단순.

### 영향 / 후속

- `packages/cli/migrations/109_*.sql` — `semo.agent_definitions` 에 `listing_id UUID` 추가하여 "이 봇 정의는 어떤 listing 에서 왔는가" 추적.
- 검수 자동 진단 워커 (안전·중복·품질) 별도 — 임베딩 유사도 > 0.95 면 중복 의심 등.
- 7봇은 처음에 `preset` + `agent_listings` 에 등록 (단, Customer 노출 페르소나와는 다름 — §6 참조).

### 위험

- `agent_slug` 가 `semo.agent_definitions.name` 과 soft ref (다른 스키마라 FK 불가). 이름 중복·삭제 시 dangling 가능. 마이그레이션 명에 명시.

---

## §4 결제 스택 — 포트원 V2 추천

### 결정

**1순위: 포트원 V2 (PortOne)**

- 한국 PG 통합 미들웨어. **월 거래액 ₩5,000만 미만 무료**, 1~5억 ₩300,000/월.
- 슈퍼 빌링키로 토스/카카오/네이버페이 정기결제 단일 API.
- Webhook V2 HMAC-SHA256 + Idempotency-Key 3시간 보장.
- `@portone/server-sdk` (npm/jsr) 공식 SDK.
- 글로벌 확장 시 Stripe 도 포트원이 연동 지원 → 벤더 락인 회피.

**2순위: 토스페이먼츠 직결**

- 카드 정기결제만 충분하고 간편결제 빌링 불필요할 때.
- 미들웨어 의존 회피, 단일 PG 의존 대신 안정성·UX·문서 품질 한국 최고.

### Why

- 소상공인 타겟이 간편결제 (토스/카카오/네이버페이) 선호도가 높음 — 토스 직결은 간편결제 빌링 미지원이 결정적 약점.
- 초기 MRR < 월 5,000만 동안은 포트원 자체 비용 0원 → 첫해 [추정] ₩330,000 절감.
- SDK 품질이 Next.js 15 + Supabase Edge Functions 환경에 적합.

### 영향 / 후속

- 후속 마이그레이션 `010_billing_DRAFT.sql` 작성 예정: `plans`, `subscriptions`, `payment_events`, `invoices` 등.
- 세금계산서: **팝빌 API** 별도 연동 ([추정] 월 ₩5,000~10,000 + 건당 ₩50~100). 포트원·토스 모두 자동 발송 X.
- 한국 전자상거래법 사전고지 의무 (결제 7일 전 리마인드) — 자체 cron 으로 발송.

### 위험

- 포트원 장애 시 디버깅 레이어 한 층 더 (포트원 + 하위 PG).
- 결제 = Webhook SoT, 클라 응답 ≠ 확정. `payment_events(provider_event_id UNIQUE)` 로 중복 차단 필수.

### 출처

- [PortOne pricing](https://www.portone.io/pricing) · [Webhook V2](https://developers.portone.io/opi/ko/integration/webhook/readme-v2?v=v2)
- [토스페이먼츠 빌링 V2](https://docs.tosspayments.com/guides/v2/billing) · [PG 수수료](https://www.tosspayments.com/about/fee)

---

## §5 모바일·데스크탑 패키징 (요약)

상세 문서: [2026-05-27-semo-dashboard-app-packaging.md](./2026-05-27-semo-dashboard-app-packaging.md)

### 결정

**Phase 0 (즉시, 2주)**: PWA 강화 — 푸시 알림, 오프라인 셸, manifest/아이콘 정비.
**Phase 1 (3-6주)**: **Capacitor** 로 iOS·Android 패키징. Next.js 정적 export 페이지 + FCM 푸시.
**Phase 2 (7-12주)**: **Tauri 2** 데스크탑 (macOS·Windows) — 시스템 트레이·알림센터 활용.

### Why

- Tauri 모바일 베타는 2026-05 시점 메인테이너 1-2명 규모, 푸시 플러그인 미완 — Capacitor 가 안전.
- Tauri 데스크탑은 stable (2024-10 릴리스), Rust 학습은 데스크탑 빌드에만 한정.
- 단일 Next.js 코드베이스 유지: 모바일=정적 export, 데스크탑·웹=SSR. FCM 단일 백엔드.

### 함정

- App Store 4.2 거절 회피 — 네이티브 탭바·푸시 액션·오프라인·마이크 quick-capture 최소 3개 선구현.
- Next.js 15 Server Components / Server Actions 정적 export 비호환 페이지 인벤토리 작성.
- iOS APNs 는 `.p8` 키 사용 (certificate 만료 함정 회피).

---

## §6 Customer 봇 페르소나 카탈로그 (요약)

상세 문서: [2026-05-27-customer-bot-personas.md](./2026-05-27-customer-bot-personas.md)

### 결정

- 7봇(semiclaw·planclaw·…) 은 **세미콜론 팀 내부 운영용**. 라이브러리 preset 으로는 등록되지만 Customer 노출 카드에는 나타나지 않음 (review_status 별도 분기 또는 `metadata.audience='internal'` 플래그).
- Customer 노출용 12개 페르소나 초안: 주문이(응대) · 새미(회계) · 재고지기(재고) · 마케타(SNS) · 스케줄러(일정) · 응대왕(리뷰응답) · 정산이(매출리포트) · 친절이(VOC) · 메뉴쟁이(상품등록) · 알림이(고객CRM) · 모집책(채용) · 안내봇(FAQ).
- 각 페르소나는 1인칭 자기소개, 캐릭터 컨셉, 핵심 일 3-5개, 필요 통합 (카카오톡/스마트스토어/네이버 예약 등), 가격 모델, 추천 업종 정의.

### Why

- 7봇 이름·페르소나는 개발자 톤. 소상공인이 보면 무엇을 하는지 직관적이지 않음.
- 라이브러리는 "채용 사이트" 메타포이므로 카드 1장이 가게 사장님 머릿속에서 즉시 "내 가게에 필요한 직원" 으로 매핑되어야 함.

### 후속

- PlanClaw 가 각 페르소나의 상세 콘텐츠(일러스트 컨셉·1인칭 자기소개·리뷰 mock) 보완.
- 초기 출시는 3-5개로 좁히고 (응대·회계·재고·SNS·스케줄링) 나머지는 Roadmap.

---

## §7 인큐베이터 분리

### 결정

**서브도메인 분리 (옵션 A)** — `incubator.semo.team` 별도 앱.

- 현재 `packages/semo-dashboard/app/projects/*` 트리는 **인큐베이터 전용 앱** 으로 분리. 동일 monorepo 안 새 패키지 `packages/semo-incubator-dashboard` 로 이전.
- 메인 `semo.team` 대시보드 사이드바에는 외부 링크 1개 (`href="https://incubator.semo.team"`, target="\_blank").
- 공유: 인증 (같은 Supabase 프로젝트), KB (같은 PG, 다른 도메인), 디자인 시스템 (npm package `@semo/ui`).

### Why

- 인큐베이터는 IA·페르소나·정보밀도 모두 메인 SaaS 와 다름 (기획자·디자이너·개발자 대상 vs 소상공인 대상).
- 같은 앱에 합치면 사이드바 비대화 + 라우팅 충돌 + 빌드 시간 증가.
- 서브도메인 분리는 deployment 별도 가능 — 인큐베이터 변경이 SaaS 출시 일정 안 막음.

### 영향 / 후속

- 인큐베이터 분리 로드맵 별도 (이건 SEMO Renewal pane 의 인큐베이터 트랙 작업).
- 도메인 라우팅: Vercel 또는 nginx 에서 `incubator.semo.team → packages/semo-incubator-dashboard`.
- 공유 패키지 추출 (auth client, kb client, ui kit) 은 점진적.

### 위험

- 분리 이전 cost — 현 `/projects` 트리 규모 [추정] 3,000~5,000 LOC. 1-2 sprint 작업.
- 의존성 정리 — 현 `/projects` 가 dashboard 의 `/agents`·`/kb` 모듈을 직접 import 하는 부분이 있다면 공유 패키지로 추출 필요.

---

## §8 통합 위험·열린 질문

1. **`semo.knowledge_base` 의 tenant_id 추가 마이그레이션** (`cli/migrations/108_*`) — 본 문서 §1·§2·§3 모두에 영향. 이 마이그레이션 자체가 별도 결정·작성 필요.
2. **결제 도입 시점** — Phase 0 (라이트 무료 출시) vs Phase 1 (베타 시점부터 유료) 정책 미결정.
3. **검수 자동 진단 워커** (§3) — 구현 주체·LLM 모델 선정 미결정.
4. **Customer 봇 1차 출시 라인업** — §6 의 12개 중 어느 3-5개를 첫 베타에 — 사용자(reus) + PlanClaw 결정 필요.

---

## §9 Verification

- 마이그레이션 3개 (007/008/009) 가 Supabase 로컬 또는 staging 에서 dry-run 통과하는지: **별도 작업 — 본 세션 범위 밖**.
- 본 결정문이 v5 플랜 ([ultrathink-semo-renewel-pane-typed-meadow.md](/Users/reus/.claude/plans/ultrathink-semo-renewel-pane-typed-meadow.md)) 의 트랙 B placeholder 와 모두 매칭되는지: §0 표로 확인 ✓.
- 디자인 의존성 있는 항목 (IA 마이그레이션) 은 본 문서 범위에서 제외했는지: ✓ (Claude Design 시안 대기).
