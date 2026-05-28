SEMO Dashboard v5 (Customer) — 남은 작업 전체 인계

당신(SEMO Renewel)이 이 작업을 끝까지 자율 완료해 주세요. 질문 없이 진행하고, 분기점은 가장 안전한 선택을 자율 결정하되 이유를 결과에 남기세요. 완료/막힘은 터미널에 보고하세요. (cmux-collaboration 규칙)

■ 가장 먼저 (NON-NEGOTIABLE)

- 경로는 반드시 ASCII 심볼릭 `/Users/reus/Desktop/Sources/semicolon/projects/semo` 사용. env가 주는 Korean 경로 문자열은 유니코드 정규화가 달라 phantom 디렉토리를 가리켜 파일이 실제 repo에 안 들어간다(직접 당함). `git -C <경로> status` 실패하면 phantom.
- 작업 시작 시 commitment 수동 생성: `semo commitments create --bot-id <자신> --title "Customer 대시보드 v5 남은 배선" --source-type claude-code-local`, 완료 시 update done.

■ 먼저 읽을 권위 문서 (전부 docs/plans/)

1. 2026-05-28-customer-dashboard-agents-integration.md ← §9 "실행 상황"이 현재 상태 + 남은 작업의 SoT
2. 2026-05-27-semo-dashboard-v5-track-b-predesign.md ← 트랙 B 7개 결정(테넌시/KB그래프/라이브러리/결제/패키징/페르소나/인큐베이터)
3. 2026-05-28-customer-personas-reconciliation.md ← 정본 7봇
4. 2026-05-27-semo-dashboard-app-packaging.md ← PWA→Capacitor→Tauri
   또 KB: `semo kb get semo decision dashboard-v5-track-b-predesign-2026-05-27`, `customer-tables-appdb-architecture-2026-05-28`, `customer-personas-v1-canonical-2026-05-28`.

■ 이미 완료 (재작업 금지)

- 라우트 그룹 app/(customer)/ + AppChrome(/my\* 에서 GlobalNav 숨김) + tokens.css.
- 8개 라우트 전부 dev HTTP 200: /my, /my/team, /my/knowledge, /my/library, /my/library/[slug](상세+채용마법사 작동), /my/plan, /my/provider(탭 작동), /my/m(모바일3).
- 인터랙션: 다크모드 토글(localStorage), KB 2D/3D 토글, 라이브러리 카드→상세, Provider 탭, 채용 마법사 next/prev/close.
- 핵심 아키텍처: 데이터=appdb(DATABASE_URL/pg.Pool), 인증=Supabase 분리. DATABASE_URL은 로컬 dev DB(localhost/appdb).
- migrations/010_customer_tables.sql(tenants/agent_listings/agent_installs/agent_activity, public, FK없음) + scripts/apply-customer-tables.mjs(멱등, localhost 가드) → 로컬 appdb 적용 완료. 시드: 데모 테넌트 정민카페 + 정본 7봇 + installs7 + activity6.
- lib/customer/data.ts(getInstalledAgents/getLibraryListings) + app/api/my/agents/route.ts(실데이터 검증됨).
- /my/team 실데이터 구동 검증(옛 mock "12건"→시드 "23건"). ScreenTeam은 agents prop 없으면 mock 폴백.
- DRAFT 007/008은 Supabase+user_profiles FK 전제라 이 아키텍처에선 010으로 대체됨(참고용으로만 남김).
- 검증 기준선: 내 파일 tsc 0 / eslint 0 / 8라우트 200. dev 서버 포트 3939에서 기동 중일 수 있음(아니면 cd packages/semo-dashboard && PORT=3939 npm run dev).

■ 남은 작업 (우선순위)
A. 나머지 화면 실데이터 배선 — Team과 동일 패턴(서버 페이지에서 lib/customer/data 호출→화면 prop 주입, 빈값 mock 폴백):

- Home(/my): agent_activity→활동 피드, installs→"지금 일하고 있어요", stats 집계. ScreenHome을 prop 구동으로. data.ts에 getActivity/getHomeStats/getNudges 추가.
- Library(/my/library, [slug]): getLibraryListings() 이미 있음 → ScreenLibraryList/Detail을 listings/agent prop으로(현재 AGENT_BY_ID mock).
  B. 멀티테넌시: 현재 DEMO_TENANT='jeongmin-cafe' 고정. Supabase 세션 user→tenant 매핑 도입(tenants.owner_user_id), data 함수에 tenantSlug 주입. 그 후 middleware의 /my\*·/api/my/ 공개경로 제거(재-게이팅). 지금은 mock 쇼케이스라 공개.
  C. KB 그래프(/my/knowledge): 009_kb_graph_views(semo.knowledge_base 기반 MV/RPC) + react-force-graph-2d/3d 신규 의존성 도입 → 정적 SVG mock을 실 그래프로. KB에 tenant_id 추가(cli/migrations/108) 선행.
  D. 결제(/my/plan): 010-billing 마이그레이션(plans/subscriptions/usage_meters/payment_events) + 포트원 V2 SDK + 팝빌(세금계산서). 결정문 §4 참조.
  E. 페르소나 콘텐츠: agents.jsx의 bio는 임시값. PlanClaw에 7봇 1인칭 자기소개·리뷰 mock 위임, DesignClaw에 SVG 캐릭터→정식 일러스트 위임(또는 슬랙 채널로).
  F. 프로덕션 적용: 010은 로컬 appdb에만 적용됨. prod 배포 시 prod DB에 010 적용(시드는 dev 전용 — 실고객은 가입 플로우로 생성). prod next build 확인(당신이 kb.ts를 direct-PG로 환원했으니 green일 것 — 검증).
  G. 트랙 B 잔여(비-대시보드, 별건): IA 마이그레이션(현 36라우트 정리), 패키징 Phase0 PWA강화→Capacitor→Tauri, 인큐베이터 incubator.semo.team 서브도메인 분리. 우선순위 낮음 — A~D 후.

■ 완료 기준
각 화면이 실 appdb 데이터로 렌더(빈값이면 graceful empty/mock), tsc 0·eslint 0, 영향 라우트 HTTP 200. 새 의사결정은 SEMO_DECISION 블록으로 KB 박제. 끝나면 터미널에 [완료] 요약(진단/조치/후속).
