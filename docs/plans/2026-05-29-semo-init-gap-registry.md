# SEMO 초기화/제품화 — 통합 갭 레지스트리 (공유 SoT)

> 작성: 2026-05-29 (Claude). 통합 출처: 시뮬레이션(`2026-05-29-semi-colony-init-simulation.md`) +
> Codex 리뷰(`...-codex-review.md`) + 고객 대시보드 핸드오프(`2026-05-28-customer-dashboard-handoff.md`) +
> 페르소나 기획(`2026-05-28-persona-pack-plan.md`) + 통합 아키텍처(`2026-05-29-semo-integrated-product-architecture.md`).
> 코드 교차검증 기준(2026-05-29). 3개 세션(Claude/SEMO Renewel/Semi Hermes)이 동시 작업 중 — 충돌 회피 위해 owner 명시.

## 동시 작업 현황 (스냅샷)

- **SEMO Renewel** (/goal active): 고객 대시보드 — 팀모드 토글, Playwright E2E, 랜딩 디자인. app/(customer)/·lib/customer/·app/api/my/ 활성 편집.
- **Semi Hermes**: packages/cli 빌드 + 페르소나 기획.
- **Claude(본 세션)**: 분석/문서/충돌 안 나는 부분 + 조율. (지금 이 레지스트리 + Colony drift 정리)

## 보정된 4대 체크포인트 (Codex 검증 반영)

| 체크              | 상태 | 근거                                                                                                                                                                                                   |
| ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ① 사용자 정보수집 | 🟡   | (A) slack-router `maybeOnboardSender` nickname/role/it-fluency upsert 구현(:1636). (B) 고객 signup=email+persona. 미완: interests/멀티턴/Block UI, **고객용 Semi 대화 온보딩 없음**                    |
| ② 초기 봇 세팅    | 🟡   | ROUTE/SEARCH/CREATE(Semi) ✅. 고객측 `tenants`/`agent_installs` 스키마 ✅ + tenant ensure ✅. 미완: **persona→agent_installs 자동 프로비저닝**                                                         |
| ③ 대시보드 연동   | 🟡   | 데모 테넌트 실데이터 ✅. 미완: **direct-chat runtime bridge**(`/api/my/chat`→`SEMO_RUNTIME_URL` 미구현, "준비 중" 반환), 실고객 자동 흐름                                                              |
| ④ 가격플랜        | 🟡   | `011_billing_tables.sql`(plans/subscriptions/usage_meters/payment_events) + 가입시 free subscription + `getBilling()` ✅. 미완: **결제 실행(포트원/팝빌)·plan-change endpoint·tier/quota enforcement** |

## 갭 레지스트리 (우선순위 = Codex 보정 순)

| #   | 갭                                                  | 우선 | Owner(권장)       | 상태                                  | 핵심 파일                                                                                                                                                              | "완료" 기준                                                                                                                     |
| --- | --------------------------------------------------- | ---- | ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Runtime bridge** — 고객 agent 실행 런타임         | P0   | Renewel/Hermes    | 🔴 scaffold만                         | `app/api/my/chat/route.ts`(`SEMO_RUNTIME_URL`), `2026-05-29-semo-integrated-product-architecture.md`                                                                   | `/api/my/chat`가 tenant agent에 실제 dispatch→응답 반환(준비중 X)                                                               |
| G2  | **persona→agent 자동 install**                      | P0   | Renewel           | 🟡                                    | `PersonaSelect.tsx`, `lib/customer/data.ts`(ensureTenantForUser), `agent_installs`                                                                                     | persona 선택 시 기본 봇 install 자동 생성                                                                                       |
| G3  | **결제 실행 + plan change + tier enforcement**      | P1   | Renewel/Hermes    | 🟡                                    | `011_billing_tables.sql`, `lib/customer/data.ts`(getBilling), (신규)`/api/my/billing/change`, 포트원/팝빌                                                              | 업그레이드 1클릭 결제 + 사용량 한도 강제                                                                                        |
| G4  | **고객용 대화 온보딩** (Semi-led, 카톡/대시보드 챗) | P1   | Hermes(기획)→구현 | 🔴                                    | Track A `maybeOnboardSender`(참고), G1 bridge 의존                                                                                                                     | 고객이 대화로 가게정보→tenant/persona/봇 셋업                                                                                   |
| G5  | **Colony role drift 정리**                          | P2   | Claude(본 세션)   | ✅ manifest / 🟡 doc                  | `docs/colony-slack-manifest.json`(✅ observer로 수정 완료), `2026-05-29-semo-integrated-product-architecture.md:~50`(action-item)                                      | manifest+문서가 role-redesign(observer)과 일치                                                                                  |
| G6  | **commitment/inbox write 원자성**                   | P2   | Claude(본 세션)   | ✅ 코드(디스크) · 🟡 재기동·검증 대기 | `slack-router/src/index.ts:1314` catch 에 commitment `failed` 마감 추가(type-clean)                                                                                    | inbox write 실패 시 commitment failed 마감 — **라이브 적용엔 cmux 내 라우터 재기동 필요**                                       |
| G7  | **@Semi route_bot_id 운영검증**                     | P2   | Claude(검증)      | ✅ 검증 GREEN                         | `.env SEMO_PRIMARY_BOT_ID=semi` + ORCHESTRATORS 조건 TRUE(semi=orchestrator/colony=observer) + 라이브 부팅로그 `route_bot_id: semi`(U0B5R3AQRKQ)·`colony`(U0B61EVHB39) | @Semi→route_bot_id=semi→handleOrchestrator 코드+config+게이트웨이 바인딩 3중 일치. 잔여: 실 end-user @Semi 멘션 1회 e2e(저위험) |
| G8  | 정보수집 확장 (interests/멀티턴/Block UI)           | P3   | —                 | 🟡                                    | `slack-router maybeOnboardSender`                                                                                                                                      | —                                                                                                                               |

### 이미 owner가 활성 진행 중(중복 트래킹만)

- 고객 대시보드 화면 실데이터(Home/Library/Plan/Knowledge), 팀모드 토글, E2E → **Renewel /goal**
- 페르소나 P0/P1(상태모델/스키마/뷰모델) → **Hermes action-items**(planclaw) 등록됨

## Track A/B 합류 (정정)

"고객이 Semi와 대화"가 합류점이 **아님**. 실제 합류점 = **G1 runtime bridge** (`/api/my/chat`→런타임이 설치된 고객 agent를 호출). 고객용 Semi 대화 온보딩(G4)은 그 위에 얹히는 별도 레이어.

## 본 세션이 지금 처리

- ✅ 이 레지스트리(공유 SoT)
- ✅ 시뮬레이션 doc supersede 노트
- 🔄 G5 Colony manifest drift 정리
- 🔄 G1·G2·G3·G4·G6·G7 → action-items 등록(owner 세션 픽업용, 충돌 회피)
