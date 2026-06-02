# Semi & Colony 초기화 흐름 시뮬레이션 + 4대 통합점 갭 분석

> 작성: 2026-05-29 (Claude 세션). 리뷰 요청 대상: SEMO Codex.
> 목적: "실제 Slack 세팅 + Semi&Colony 배치 + Semi로부터 이니셜라이징" 가정하에 초기화 흐름을
> 끝까지 시뮬레이션하고, ①사용자 정보수집 ②초기 봇 세팅 ③대시보드 연동 ④가격플랜 4지점을 점검.
> ⚠️ 파일 편집 없이 분석만 수행(동시 작업 중인 SEMO Renewel 충돌 회피).
>
> 🔄 **2026-05-29 보정**: SEMO Codex 리뷰(`...-codex-review.md`)가 코드 교차검증으로 아래 판정 일부를
> 바로잡음 — 이 문서는 **스냅샷 시점**(동시 세션이 더 구현해둠) 기준이라 일부 🔴 가 실제 🟡.
> **최신·통합 SoT = [통합 갭 레지스트리](./2026-05-29-semo-init-gap-registry.md)**. 아래 표는 원본 보존용.
> 주요 보정: 가격플랜 🔴→🟡(011_billing+free subscription 구현), Track A 정보수집 🔴→🟡
> (maybeOnboardSender 구현), Track B 가입→tenant 체인 동작(끊김=persona→agent auto-install).
> 놓친 통합점: 대시보드 direct-chat **runtime bridge**(`/api/my/chat`→`SEMO_RUNTIME_URL`)가 실제 합류점.

## 근거 (grounding)

- KB: `semo/decision/one-agent-experience-implementation-2026-05-27`, `semo/decision/semi-colony-role-redesign-2026-05-29`, `semo/decision/colony-slack-primary-bot-2026-05-27`
- docs: `semi-colony-onboarding-and-obsidian-plan.md`, `colony-slack-manifest.json`, `openclaw-slack-app-private-plan.md`, `dashboard-multi-driver-deployment.md`, `2026-05-28-customer-dashboard-handoff.md`, `2026-05-28-persona-pack-plan.md`
- 코드: `packages/slack-router/src/index.ts`(dispatchToInbox), `app/(customer)/dashboard/signup/page.tsx`, `lib/customer/{data.ts,persona/*}`, `migrations/010_customer_tables.sql`

## 0. "Semi & Colony" 실체

- **Semi** = Slack 단일 진입점 오케스트레이터. 단순질문 직접답변 / `ROUTE: <bot>` 위임 / `SEARCH_LIBRARY`·`CREATE` / commitment 생성·보고.
- **Colony** = 채널 관찰자(KB 보강). manifest는 "Agent Factory builder"로 적혀 있으나 role-redesign이 Factory를 Semi로 흡수 → **manifest vs 결정 불일치(정합성 정리 필요)**.
- **7봇**은 `app_mention` 제거로 비공개, Semi가 `SEMO_REPLY_WRAP_PERSONA=1`로 wrap.
- 이건 **세미콜론 팀 내부 Slack 시스템(Track A)**. 가격이 붙는 **고객 SaaS(Track B)** 와 별개.

범례: ✅작동 · 🟡부분/진행중 · 🔴미구현·갭

## Track A — 내부 Slack(Semi&Colony) "Semi로부터 이니셜라이징"

| 단계             | 실제                                                                                                           | 상태 |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ---- |
| Slack 세팅       | Colony manifest 준비, Semi 실제 멘션 4건 검증, Colony는 App install 후 Slack 검증 "예정"                       | 🟡   |
| Semi&Colony 배치 | `@Semi`→Hermes→`ROUTE`→inbox dispatch + `bot_commitments` INSERT 검증                                          | ✅   |
| 정보 수집        | Phase1(slack-id lookup + 한 줄 권유)만. **Phase2 대화형 수집(이름/역할/AI친숙도/관심)=설계만(옵션 C), 미구현** | 🔴   |
| 초기 봇 세팅     | ROUTE(7봇) ✅ / SEARCH_LIBRARY·CREATE(agent-factory CLI) ✅ / 7봇 비공개화 스크립트 미실행                     | 🟡   |

→ Track A의 "Semi 이니셜라이징"은 **팀원 등록** 흐름(고객 아님). 가격 없음.

## Track B — 고객 SaaS (가격플랜 부착 지점)

| 단계          | 실제                                                                                                                    | 상태                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 가입(수집1)   | `/dashboard/signup` 이메일/비번(Supabase) → `/dashboard/start`                                                          | ✅ / 업종·가게정보 미수집 🟡 |
| 온보딩(수집2) | `/dashboard/start`에서 PersonaSelect→tenant 생성 (Renewel 진행 중)                                                      | 🟡                           |
| 초기 봇 세팅  | persona pack이 라인업 결정. `tenants`/`agent_installs` 테이블 ✅(데모 시드). **가입시 자동 install 프로비저닝 미확인**  | 🟡                           |
| 대시보드 연동 | tenant→/my(/dashboard)→Team(실데이터)·Home. 데모 테넌트 실연동 검증("23건"). 실고객 자동흐름 Renewel 배선중             | 🟡                           |
| 가격플랜      | `tenants.plan_slug`('starter') 필드만. **플랜선택 UI·결제(포트원)·사용량미터·티어강제 전부 미구현**(010-billing 미작성) | 🔴                           |

## 4대 체크포인트

| 체크       | Track A               | Track B                   | 연동                                                  |
| ---------- | --------------------- | ------------------------- | ----------------------------------------------------- |
| ① 정보수집 | 🔴 대화형 미구현      | 🟡 email+persona          | Semi-주도 대화수집이 고객 경로엔 없음 🔴              |
| ② 봇세팅   | ✅ ROUTE/CREATE       | 🟡 자동 프로비저닝 미확인 | 7봇 vs 고객봇 별 카탈로그(audience 태그) 🟡           |
| ③ 대시보드 | ✅ /orchestrator-flow | 🟡 데모만 실연동          | 내부 vs 고객 대시보드 분리, /my vs /dashboard 혼재 🟡 |
| ④ 가격     | N/A                   | 🔴 필드만                 | 가격은 Track B 전용·거의 미구현 🔴                    |

## 결론 (주장 — 리뷰 포인트)

1. **"Semi로부터 이니셜라이징"은 현재 팀(Slack) 전용**. 고객은 Semi와 대화 안 하고 웹 폼으로 초기화. "고객도 Semi 대화로 셋업" 비전이면 → 고객용 Semi(대시보드 챗/카카오톡) + Phase2 대화온보딩 + tenant/persona/plan 프로비저닝 연결이 통째 갭 🔴.
2. 정보수집→봇세팅→대시보드는 Track B에서 부분적으로만 이어짐(데모로 검증). 가입→자동 tenant+봇 프로비저닝→플랜부여 원클릭 체인 미완.
3. 가격플랜 사실상 미구현(필드 1개). 010-billing+포트원 필요.
4. 정합성 갭: Colony manifest vs role-redesign, /my vs /dashboard 라우트 혼재.

→ **"끝까지 동작하는 Semi 주도 초기화"는 미완주.** signup→start까지 굴러가나 ③자동 봇 프로비저닝·④플랜부여에서 끊김.

---

## SEMO Codex 리뷰 요청 항목

1. 위 ✅/🟡/🔴 판정에 **사실 오류**가 있나? (특히 코드 근거로 반박)
2. Track A/B 분리 진단이 맞나, 아니면 이미 합쳐지는 설계가 있나?
3. 가장 크리티컬한 갭 우선순위 동의하나? (자동 프로비저닝 체인 vs 고객용 Semi 대화 vs 가격)
4. 내가 **놓친 통합점/리스크**가 있나?
