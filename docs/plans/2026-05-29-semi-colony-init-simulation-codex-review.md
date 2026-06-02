# Codex Review: Semi & Colony 초기화 시뮬레이션

대상: `docs/plans/2026-05-29-semi-colony-init-simulation.md`  
검토일: 2026-05-29  
범위: 문서/KB/코드 교차검증. 코드 수정 없음.

## Findings

### 1. 가격플랜 판정은 사실 오류가 있다: `🔴 필드만`이 아니라 `🟡 데이터 모델 + 읽기 UI 있음`

원문은 Track B 가격플랜을 "`tenants.plan_slug` 필드만", "010-billing 미작성", "플랜선택 UI/사용량미터 전부 미구현"이라고 했는데 현재 코드와 맞지 않는다.

- `packages/semo-dashboard/migrations/011_billing_tables.sql:14`부터 `plans`, `subscriptions`, `usage_meters`, `payment_events`를 생성한다.
- 같은 파일 `:6`은 이 마이그레이션이 "데이터 모델만 정의"하며 포트원/팝빌 실행 통합은 별도라고 명시한다.
- `packages/semo-dashboard/lib/customer/data.ts:75`는 신규 테넌트 생성 시 `plan_slug='free'`를 넣고, `:90`에서 `subscriptions(plan_slug='free')`도 생성한다.
- `packages/semo-dashboard/lib/customer/data.ts:503`의 `getBilling()`은 `plans/subscriptions/usage_meters/payment_events`를 실제 조회한다.

따라서 가격 상태는 `🔴 거의 없음`이 아니라 `🟡 결제 실행/업그레이드 액션/티어 enforcement 미완`이 맞다. 결제 크리덴셜, PortOne/Popbill 연동, plan-change endpoint, quota enforcement는 여전히 갭이다.

### 2. Track A 정보수집 `🔴 Phase2 미구현`은 오래된 판단이다: 현재는 `🟡 부분 구현`

원문은 Slack 정보수집을 Phase1만 있고 Phase2 대화형 수집은 설계만이라고 했지만, `slack-router`에는 이미 자기소개 한 문장 기반 등록 코드가 있다.

- `packages/slack-router/src/index.ts:1422`는 Slack user id로 KB 프로필을 조회한다.
- `packages/slack-router/src/index.ts:1463` 이후가 Phase 2 온보딩 구현이다. `nickname`, `role`, `it-fluency`를 정규식과 선택적 LLM으로 추출한다.
- `packages/slack-router/src/index.ts:1636`의 `maybeOnboardSender()`는 추출 결과를 KB에 `slack-id`, `nickname`, `role`, `it-fluency`로 upsert한다.
- `packages/slack-router/src/index.ts:1763`에서 미등록 사용자의 메시지에 이 온보딩을 실제로 연결한다.

다만 관심사/interests 수집, 멀티턴 질문, Slack Block UI, 검증/수정 흐름은 없다. 그러므로 `🔴`이 아니라 `🟡 one-line onboarding partial`로 보정해야 한다.

### 3. Track B 가입/온보딩은 원문보다 더 연결돼 있다. 단, 자동 봇 프로비저닝은 여전히 미확인/미완

원문의 "Renewel 진행 중" 표현은 너무 느슨하다. 가입 이후 최소 tenant 생성 체인은 코드로 연결되어 있다.

- `packages/semo-dashboard/app/(customer)/dashboard/signup/page.tsx:25`는 Supabase signup/login 후 `:39`에서 `/dashboard/start`로 보낸다.
- `packages/semo-dashboard/app/(customer)/dashboard/start/page.tsx:21`은 기존 tenant가 있으면 `/dashboard`로 보내고, 없으면 `PersonaSelect`를 렌더한다.
- `packages/semo-dashboard/app/(customer)/_ui/PersonaSelect.tsx:22`는 persona 저장 후 `:30`에서 `/api/my/tenant/ensure`를 호출한다.
- `packages/semo-dashboard/lib/customer/data.ts:75`는 이 호출의 결과로 tenant와 free subscription을 보장한다.

따라서 "가입 -> persona -> tenant/free subscription"은 동작 경로가 있다. 그러나 persona 선택이 `agent_installs` 자동 생성까지 이어진 근거는 확인되지 않았다. 원문의 `초기 봇 세팅 🟡`은 유지하되, 끊기는 지점은 "tenant 생성"이 아니라 "persona 기반 자동 install/provisioning"으로 좁혀야 한다.

### 4. Track A/B 분리 진단은 대체로 맞지만, 핵심 통합점 하나가 빠졌다: Dashboard direct-chat runtime bridge

Track A는 Slack orchestrated flow, Track B는 customer dashboard flow로 분리되어 있다는 진단은 맞다. 하지만 "합쳐지는 설계가 전혀 없다"는 식으로 읽히면 부정확하다. 현재 합류 지점은 Semi 대화 온보딩이 아니라 dashboard direct-chat bridge다.

- `docs/plans/2026-05-29-semo-integrated-product-architecture.md:35`는 Dashboard가 container이고 agent mailbox가 host fs라 direct-chat runtime bridge가 필요하다고 명시한다.
- 같은 문서 `:43`은 현재 bridge가 미구현이고 dashboard API 계약/UX만 scaffold라고 적는다.
- `packages/semo-dashboard/app/api/my/chat/route.ts:7`은 tenant-owned agent와만 직접 대화하게 하고, `:60`의 `SEMO_RUNTIME_URL`이 없으면 `:62`에서 "준비 중" 응답을 반환한다.

즉 Track B는 Semi-led Slack onboarding과 합쳐진 것이 아니라, 설치된 customer agent를 runtime bridge로 호출하는 별도 통합점으로 합쳐질 설계다. 이 통합점은 원문의 4대 체크포인트 중 "대시보드 연동" 리스크에 명시되어야 한다.

### 5. Colony role drift는 원문 지적보다 범위가 넓다

원문은 `docs/colony-slack-manifest.json`만 정합성 갭으로 지적했는데, 관련 설계 문서에도 drift가 남아 있다.

- 코드 기준: `packages/slack-router/src/index.ts:1136`은 Semi를 `canManageAgents: true`, `:1147`은 Colony를 `role: 'observer'`, `canManageAgents: false`로 등록한다.
- manifest 기준: `docs/colony-slack-manifest.json:4`는 여전히 "Agent Factory builder"라고 설명한다.
- 통합 아키텍처 문서 기준: `docs/plans/2026-05-29-semo-integrated-product-architecture.md:50`은 `Colony=SEARCH/CREATE`라고 적고 있어 최신 role redesign과 충돌한다.

이 drift는 단순 문구 문제가 아니라 Slack 사용자에게 잘못된 mental model을 주는 설정/문서 리스크다. 우선순위는 높게 둬도 된다.

### 6. `@Semi` Slack routing은 "배치 완료" 판정 전에 effective `route_bot_id` 검증이 필요하다

Semi/Colony orchestrator 경로 자체는 구현되어 있다.

- `packages/slack-router/src/index.ts:2014`는 `msg.route_bot_id`가 `ORCHESTRATORS`에 있으면 `handleOrchestrator()`로 보낸다.
- `packages/slack-router/src/index.ts:2028` 이후는 dedicated app mention fallback이다.
- `packages/slack-router/src/router-policy.ts:38`은 OpenClaw-owned bot direct mailbox route를 막는다.

따라서 `@Semi`가 실제로 `route_bot_id='semi'`로 들어오면 정상적으로 Semi orchestrator가 먼저 잡는다. 반대로 운영 환경에서 Semi 토큰이 SemoBot/다른 앱 토큰과 alias되어 `route_bot_id`가 다르게 찍히면, 원문/운영 로그처럼 default route 또는 OpenClaw policy block으로 흐를 수 있다. Track A "Semi&Colony 배치 ✅"는 코드만으로는 충분하지 않고, 실제 env token 분리와 inbound gateway의 `route_bot_id` 실측이 함께 필요하다.

### 7. 놓친 운영 리스크: commitment 생성과 inbox write 실패의 원자성이 없다

Semi `ROUTE` dispatch는 commitment를 먼저 만들고 inbox에 쓴다.

- `packages/slack-router/src/index.ts:1273`에서 `bot_commitments`를 active로 insert한다.
- `packages/slack-router/src/index.ts:1301`에서야 inbox write를 시도한다.
- `packages/slack-router/src/index.ts:1314`에서 inbox write 실패 시 error를 반환하지만, 앞서 만든 commitment를 failed로 마감하지 않는다.

inbox write 실패나 filesystem 오류가 나면 active commitment만 남아 stale 처리될 수 있다. 원문의 "Semi -> ROUTE -> inbox dispatch + commitment 검증" 항목에 observability/failure handling 갭으로 추가하는 편이 좋다.

## Review Questions

1. 판정 사실오류: 있다. 특히 가격플랜 `🔴`과 Track A 정보수집 `🔴`은 현재 코드 기준으로 `🟡`가 맞다. Track B 가입/tenant/free subscription도 원문보다 구현도가 높다.
2. Track A/B 분리: 대체로 맞다. 다만 Track B의 합류점은 "고객도 Semi와 대화"가 아니라 `/api/my/chat` -> `SEMO_RUNTIME_URL` runtime bridge다.
3. 갭 우선순위: 원문 우선순위에 부분 동의한다. 보정하면 `1) runtime bridge`, `2) persona -> agent install/provisioning`, `3) payment execution + plan change + tier enforcement`, `4) customer용 대화 온보딩`, `5) Colony role drift 정리` 순서가 더 정확하다.
4. 놓친 통합점/리스크: direct-chat bridge, routing token/route_bot_id 실측, commitment/inbox 원자성, Colony role drift의 문서 범위 확대가 빠져 있다.

## Suggested Corrections To Original Summary

- Track A 정보수집: `🔴 설계만` -> `🟡 nickname/role/it-fluency one-line KB upsert 구현, interests/multiturn 미구현`
- Track B 가격플랜: `🔴 필드만` -> `🟡 billing schema/read UI/free subscription 구현, 결제 실행/업그레이드/tier enforcement 미구현`
- Track B 온보딩: `🟡 Renewel 진행 중` -> `🟡 signup -> start -> persona -> tenant/free subscription 구현, agent auto-install 미연결`
- 대시보드 연동: `🟡 데모만 실연동`에 `runtime bridge 미구현`을 명시
- 정합성 갭: `Colony manifest`뿐 아니라 integrated architecture doc의 `Colony=SEARCH/CREATE`도 수정 대상

KB: not-needed -- 리뷰 산출물이며 새 운영 결정은 없음.
